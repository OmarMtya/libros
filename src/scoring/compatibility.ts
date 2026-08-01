import Decimal from 'decimal.js';
import { MatchingOperator } from '@prisma/client';
import { computeDimensionWeights, computeDomainWeights, DOMAIN_DIMENSIONS } from './domain-weights';
import { PriorityVector } from './priority-vector';

export const clamp01 = (value: Decimal.Value): Decimal => Decimal.max(0, Decimal.min(1, new Decimal(value)));

export const round4 = (value: Decimal.Value): Decimal => new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

export type ReaderDimension = {
  dimensionKey: string;
  bookFeatureKey: string | null;
  dimensionKind: string;
  matchingOperator: MatchingOperator;
  value: Decimal | null;
  confidence: Decimal;
};

export type BookFeature = {
  value: Decimal;
  confidence: Decimal;
};

export type BookFeatureMap = ReadonlyMap<string, BookFeature>;

export type UserTag = {
  tagKey: string;
  tagType: string;
  affinity: Decimal;
  confidence: Decimal;
};

export type BookTagSignal = {
  tagKey: string;
  tagType: string;
  strength: Decimal;
  replacementTagKey?: string | null;
};

export const READER_MIN_CONFIDENCE = new Decimal(0.15);
export const BOOK_MIN_CONFIDENCE = new Decimal(0.2);

export function compatible(matchingOperator: MatchingOperator, readerValue: Decimal, bookValue: Decimal): Decimal {
  switch (matchingOperator) {
    case MatchingOperator.absolute_distance:
      return clamp01(new Decimal(1).minus(bookValue.minus(readerValue).abs()));
    case MatchingOperator.minimum_threshold:
      return bookValue.gte(readerValue) ? new Decimal(1) : clamp01(new Decimal(1).minus(readerValue.minus(bookValue)));
    case MatchingOperator.maximum_threshold:
      return bookValue.lte(readerValue) ? new Decimal(1) : clamp01(new Decimal(1).minus(bookValue.minus(readerValue)));
    default:
      return new Decimal(0);
  }
}

export type EligibleNumericDim = {
  dimension: ReaderDimension;
  bookValue: Decimal;
  bookConfidence: Decimal;
};

export function eligibleNumericDimensions(readerDimensions: ReaderDimension[], features: BookFeatureMap): EligibleNumericDim[] {
  return readerDimensions.flatMap((dimension) => {
    if (dimension.matchingOperator === MatchingOperator.selection_control) return [];
    if (!dimension.bookFeatureKey) return [];
    if (dimension.value === null || dimension.confidence.lt(READER_MIN_CONFIDENCE)) return [];
    const bookFeature = features.get(dimension.bookFeatureKey);
    if (!bookFeature || bookFeature.confidence.lt(BOOK_MIN_CONFIDENCE)) return [];
    return [{ dimension, bookValue: bookFeature.value, bookConfidence: bookFeature.confidence }];
  });
}

export type NumericFitResult = {
  score: Decimal | null;
  ewByDim: Array<{ dimensionKey: string; readerValue: Decimal; bookValue: Decimal; compatibleValue: Decimal; effectiveWeight: Decimal }>;
};

export function numericFit(readerDimensions: ReaderDimension[], features: BookFeatureMap, priorityVector: PriorityVector | null): NumericFitResult {
  const eligible = eligibleNumericDimensions(readerDimensions, features);
  if (eligible.length === 0 || !priorityVector) return { score: null, ewByDim: [] };

  const domainWeights = computeDomainWeights(priorityVector);
  const numericWeights = computeDimensionWeights(domainWeights, eligible.map((item) => item.dimension.dimensionKey));
  const total = Object.values(numericWeights).reduce((acc, weight) => acc.plus(weight), new Decimal(0));
  if (total.eq(0)) return { score: null, ewByDim: [] };
  const normalization = new Decimal(1).div(total);
  const dimensionWeights: Record<string, Decimal> = {};
  for (const [key, weight] of Object.entries(numericWeights)) dimensionWeights[key] = new Decimal(weight).mul(normalization);

  const sorted = [...eligible].sort((a, b) => a.dimension.dimensionKey.localeCompare(b.dimension.dimensionKey));
  let sumEW = new Decimal(0);
  let sumEWC = new Decimal(0);
  const ewByDim: NumericFitResult['ewByDim'] = [];
  for (const entry of sorted) {
    const weight = dimensionWeights[entry.dimension.dimensionKey] ?? new Decimal(0);
    const compatibilityValue = compatible(entry.dimension.matchingOperator, entry.dimension.value!, entry.bookValue);
    const effectiveWeight = weight.mul(entry.dimension.confidence).mul(entry.bookConfidence);
    sumEW = sumEW.plus(effectiveWeight);
    sumEWC = sumEWC.plus(effectiveWeight.mul(compatibilityValue));
    ewByDim.push({
      dimensionKey: entry.dimension.dimensionKey,
      readerValue: entry.dimension.value!,
      bookValue: entry.bookValue,
      compatibleValue: compatibilityValue,
      effectiveWeight,
    });
  }
  const score = sumEW.gt(0) ? round4(sumEWC.div(sumEW)) : null;
  return { score, ewByDim };
}

export type TagFitResult = {
  score: Decimal | null;
  raw: Decimal;
  scale: Decimal;
  matches: Array<{ tagKey: string; tagType: string; affinity: Decimal; strength: Decimal }>;
};

export function tagFit(userTags: UserTag[], bookTags: BookTagSignal[]): TagFitResult {
  const userByKey = new Map(userTags.map((tag) => [tag.tagKey, tag]));
  const resolvedBookTags = new Map<string, BookTagSignal>();
  for (const bookTag of bookTags) {
    const key = bookTag.replacementTagKey ?? bookTag.tagKey;
    if (!resolvedBookTags.has(key)) resolvedBookTags.set(key, bookTag);
  }

  let raw = new Decimal(0);
  const matches: TagFitResult['matches'] = [];
  for (const key of [...resolvedBookTags.keys()].sort()) {
    const bookTag = resolvedBookTags.get(key)!;
    const userTag = userByKey.get(key);
    if (!userTag || userTag.tagType !== bookTag.tagType) continue;
    raw = raw.plus(userTag.affinity.mul(bookTag.strength).mul(userTag.confidence));
    matches.push({ tagKey: key, tagType: bookTag.tagType, affinity: userTag.affinity, strength: bookTag.strength });
  }
  const scale = userTags.reduce((acc, tag) => acc.plus(tag.affinity.abs()), new Decimal(0));
  const score = scale.gt(0) ? round4(new Decimal(1).add(raw.div(scale)).div(2)) : null;
  return { score, raw, scale, matches };
}

export function lengthFit(pages: number | null, minPages: number | null, maxPages: number | null): Decimal | null {
  if (pages === null || minPages === null || maxPages === null) return null;
  if (pages >= minPages && pages <= maxPages) return new Decimal(1);
  if (pages < minPages) return clamp01(new Decimal(1).minus(new Decimal(minPages - pages).div(Math.max(1, minPages))));
  return clamp01(new Decimal(1).minus(new Decimal(pages - maxPages).div(Math.max(1, maxPages))));
}

export function coveragePenalty(requiredConfidences: Decimal[]): Decimal {
  if (requiredConfidences.length === 0) return new Decimal(0.25);
  const factor = requiredConfidences.reduce((acc, confidence) => acc.plus(confidence), new Decimal(0)).div(requiredConfidences.length);
  return Decimal.max(0, new Decimal(0.5).minus(factor)).mul(0.5);
}

export const BASE_FINAL_WEIGHTS = {
  numeric: new Decimal(0.5),
  tag: new Decimal(0.2),
  context: new Decimal(0.2),
  discovery: new Decimal(0.1),
} as const;

export type ScoreComponents = {
  numericFit: Decimal | null;
  tagFit: Decimal | null;
  contextFit: Decimal | null;
  discoveryFit: Decimal | null;
};

export type FinalScoreResult = {
  score: Decimal | null;
  weights: Record<'numeric' | 'tag' | 'context' | 'discovery', Decimal>;
};

const COMPONENT_FIELD: Record<keyof typeof BASE_FINAL_WEIGHTS, keyof ScoreComponents> = {
  numeric: 'numericFit',
  tag: 'tagFit',
  context: 'contextFit',
  discovery: 'discoveryFit',
};

export function finalScore(components: ScoreComponents, riskPenalty: Decimal): FinalScoreResult {
  const present: Array<keyof typeof BASE_FINAL_WEIGHTS> = [];
  const values: Record<keyof typeof BASE_FINAL_WEIGHTS, Decimal> = { numeric: new Decimal(0), tag: new Decimal(0), context: new Decimal(0), discovery: new Decimal(0) };
  for (const key of Object.keys(BASE_FINAL_WEIGHTS) as Array<keyof typeof BASE_FINAL_WEIGHTS>) {
    const value = components[COMPONENT_FIELD[key]];
    if (value === null) continue;
    present.push(key);
    values[key] = value;
  }
  if (present.length === 0) {
    return { score: null, weights: { numeric: new Decimal(0), tag: new Decimal(0), context: new Decimal(0), discovery: new Decimal(0) } };
  }
  const total = present.reduce((acc, key) => acc.plus(BASE_FINAL_WEIGHTS[key]), new Decimal(0));
  const weights = { numeric: new Decimal(0), tag: new Decimal(0), context: new Decimal(0), discovery: new Decimal(0) };
  for (const key of present) weights[key] = BASE_FINAL_WEIGHTS[key].div(total);
  let acc = new Decimal(0);
  for (const key of present) acc = acc.plus(weights[key].mul(values[key]));
  return { score: round4(clamp01(acc.minus(riskPenalty))), weights };
}

export const CONTEXT_COVERAGE_COMPONENTS = 8;

export function recommendationEvidenceCoverage(components: Array<Decimal | null>): Decimal {
  const present = components.filter((component) => component !== null).length;
  return round4(new Decimal(present).div(CONTEXT_COVERAGE_COMPONENTS));
}

export { DOMAIN_DIMENSIONS };
