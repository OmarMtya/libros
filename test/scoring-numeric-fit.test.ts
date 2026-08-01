import Decimal from 'decimal.js';
import { MatchingOperator } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  BookFeatureMap,
  finalScore,
  lengthFit,
  numericFit,
  recommendationEvidenceCoverage,
  round4,
  tagFit,
  ReaderDimension,
  UserTag,
  BookTagSignal,
} from '../src/scoring/compatibility';
import { buildPriorityVector } from '../src/scoring/priority-vector';

const readerDimension = (overrides: Partial<ReaderDimension>): ReaderDimension => ({
  dimensionKey: 'dim',
  bookFeatureKey: 'feature',
  dimensionKind: 'target',
  matchingOperator: MatchingOperator.absolute_distance,
  value: new Decimal(0.5),
  confidence: new Decimal(0.5),
  ...overrides,
});

const features = (entries: Array<[string, number, number]>): BookFeatureMap =>
  new Map(entries.map(([key, value, confidence]) => [key, { value: new Decimal(value), confidence: new Decimal(confidence) }]));

describe('numericFit (spec §11.4)', () => {
  const dims: ReaderDimension[] = [
    readerDimension({ dimensionKey: 'hook_need', bookFeatureKey: 'hook_speed', dimensionKind: 'minimum_required', matchingOperator: MatchingOperator.minimum_threshold, value: new Decimal(0.8), confidence: new Decimal(0.62) }),
    readerDimension({ dimensionKey: 'pace_preference', bookFeatureKey: 'narrative_pace', dimensionKind: 'target', matchingOperator: MatchingOperator.absolute_distance, value: new Decimal(0.7), confidence: new Decimal(0.48) }),
    readerDimension({ dimensionKey: 'tension_preference', bookFeatureKey: 'tension_level', dimensionKind: 'target', matchingOperator: MatchingOperator.absolute_distance, value: new Decimal(0.85), confidence: new Decimal(0.5) }),
    readerDimension({ dimensionKey: 'comfort_preference', bookFeatureKey: 'comfort_level', dimensionKind: 'target', matchingOperator: MatchingOperator.absolute_distance, value: new Decimal(0.4), confidence: new Decimal(0.3) }),
  ];
  const bookFeatures = features([
    ['hook_speed', 0.7, 0.78],
    ['narrative_pace', 0.6, 0.7],
    ['tension_level', 0.9, 0.8],
    ['comfort_level', 0.3, 0.65],
  ]);
  const priority = buildPriorityVector(['plot', 'characters', 'emotion']);

  it('reproduce el ejemplo numérico del spec', () => {
    const result = numericFit(dims, bookFeatures, priority);
    expect(result.score).not.toBeNull();
    expect(result.score!.toNumber()).toBeCloseTo(0.9109, 3);
  });

  it('es determinista: el orden de entrada no cambia el resultado', () => {
    const reversed = [...dims].reverse();
    const first = numericFit(dims, bookFeatures, priority);
    const second = numericFit(reversed, bookFeatures, priority);
    expect(second.score!.minus(first.score!).abs().lte(0.0001)).toBe(true);
  });

  it('ΣEW = 0 → null (sin dimensiones elegibles)', () => {
    const lowConfidence = dims.map((dimension) => ({ ...dimension, confidence: new Decimal(0.05) }));
    const result = numericFit(lowConfidence, bookFeatures, priority);
    expect(result.score).toBeNull();
  });

  it('excluye dimensiones sin feature del libro y selección_control', () => {
    const withControl = [...dims, readerDimension({ dimensionKey: 'discovery_appetite', bookFeatureKey: 'discovery_profile', dimensionKind: 'selection_control', matchingOperator: MatchingOperator.selection_control, value: new Decimal(0.5), confidence: new Decimal(0.8) })];
    const result = numericFit(withControl, bookFeatures, priority);
    expect(result.ewByDim.length).toBe(4);
  });
});

describe('tagFit (spec §11.5)', () => {
  const userTags: UserTag[] = [
    { tagKey: 'psychological_thriller', tagType: 'genre', affinity: new Decimal(0.8), confidence: new Decimal(0.75) },
    { tagKey: 'slow_burn_unsupported', tagType: 'theme', affinity: new Decimal(-0.5), confidence: new Decimal(0.4) },
  ];
  const bookTags: BookTagSignal[] = [{ tagKey: 'psychological_thriller', tagType: 'genre', strength: new Decimal(0.9) }];

  it('reproduce el ejemplo numérico del spec', () => {
    const result = tagFit(userTags, bookTags);
    expect(result.score!.toNumber()).toBeCloseTo(0.7077, 4);
    expect(result.raw.toNumber()).toBeCloseTo(0.54, 4);
    expect(result.scale.toNumber()).toBeCloseTo(1.3, 4);
  });

  it('scale = 0 → null', () => {
    const result = tagFit([], bookTags);
    expect(result.score).toBeNull();
  });

  it('sustituye tags deprecated por su reemplazo', () => {
    const bookTagsWithDeprecated: BookTagSignal[] = [{ tagKey: 'anglo_american', tagType: 'cultural_context', strength: new Decimal(0.8), replacementTagKey: 'anglo_united_states' }];
    const userTagsReplacement: UserTag[] = [{ tagKey: 'anglo_united_states', tagType: 'cultural_context', affinity: new Decimal(0.6), confidence: new Decimal(0.5) }];
    const result = tagFit(userTagsReplacement, bookTagsWithDeprecated);
    expect(result.matches[0]?.tagKey).toBe('anglo_united_states');
    expect(result.score!.toNumber()).toBeCloseTo(0.7, 4);
  });
});

describe('lengthFit (spec §5.4.1)', () => {
  it('dentro del rango → 1', () => {
    expect(lengthFit(320, 180, 420)!.toNumber()).toBe(1);
  });
  it('por debajo del mínimo penaliza', () => {
    const value = lengthFit(90, 180, 420)!;
    expect(value.toNumber()).toBeCloseTo(1 - 90 / 180, 4);
  });
  it('por encima del máximo penaliza', () => {
    const value = lengthFit(840, 180, 420)!;
    expect(value.toNumber()).toBeCloseTo(1 - 420 / 420, 4);
  });
  it('sin datos → null', () => {
    expect(lengthFit(null, 180, 420)).toBeNull();
    expect(lengthFit(320, null, null)).toBeNull();
  });
});

describe('finalScore (spec §7.3)', () => {
  it('redistribución con tag null → 0.625/0.25/0.125', () => {
    const result = finalScore({ numericFit: new Decimal(0.9), tagFit: null, contextFit: new Decimal(0.8), discoveryFit: new Decimal(0.7) }, new Decimal(0));
    expect(result.weights.numeric.toNumber()).toBeCloseTo(0.625, 4);
    expect(result.weights.context.toNumber()).toBeCloseTo(0.25, 4);
    expect(result.weights.discovery.toNumber()).toBeCloseTo(0.125, 4);
    const sum = result.weights.numeric.plus(result.weights.tag).plus(result.weights.context).plus(result.weights.discovery);
    expect(sum.toNumber()).toBeCloseTo(1, 4);
  });

  it('resta risk_penalty y clamp 0..1', () => {
    const result = finalScore({ numericFit: new Decimal(0.5), tagFit: new Decimal(0.5), contextFit: new Decimal(0.5), discoveryFit: new Decimal(0.5) }, new Decimal(0.4));
    expect(result.score!.toNumber()).toBeCloseTo(0.1, 4);
  });

  it('todos los componentes null → score null', () => {
    const result = finalScore({ numericFit: null, tagFit: null, contextFit: null, discoveryFit: null }, new Decimal(0));
    expect(result.score).toBeNull();
  });
});

describe('recommendationEvidenceCoverage (§10.4)', () => {
  it('cuenta componentes no nulos sobre 8', () => {
    const coverage = recommendationEvidenceCoverage([new Decimal(0.9), new Decimal(0.7), new Decimal(1), null, null, null, null, null]);
    expect(coverage.toNumber()).toBeCloseTo(0.375, 4);
  });
});

describe('round4', () => {
  it('redondea HALF_UP a 4 decimales', () => {
    expect(round4(0.12345).toNumber()).toBe(0.1235);
  });
});
