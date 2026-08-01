import Decimal from 'decimal.js';
import { DIMENSIONS } from '../profile/catalog';
import { PriorityFactor, PriorityVector } from './priority-vector';

export const SCORING_CALCULATION_VERSION = 'scoring/1.0';

export const NUMERIC_DOMAINS = ['narrative_pacing', 'structure_clarity', 'characters_relationships', 'style_voice', 'emotional_experience', 'cognitive_demand'] as const;
export type NumericDomain = (typeof NUMERIC_DOMAINS)[number];

export const DOMAIN_DIMENSIONS: Record<NumericDomain, string[]> = Object.fromEntries(
  NUMERIC_DOMAINS.map((domain) => [domain, DIMENSIONS.filter((dimension) => dimension.domainKey === domain).map((dimension) => dimension.key)]),
) as Record<NumericDomain, string[]>;

export const DOMAIN_ALLOCATION: Record<PriorityFactor, Partial<Record<NumericDomain, number>>> = {
  plot: { narrative_pacing: 0.6, structure_clarity: 0.4 },
  characters: { characters_relationships: 1 },
  ideas: { cognitive_demand: 1 },
  atmosphere: { emotional_experience: 0.5, style_voice: 0.5 },
  style: { style_voice: 1 },
  emotion: { emotional_experience: 1 },
};

const BASE_DOMAIN_WEIGHT = new Decimal(0.1);

export function computeDomainWeights(priorityVector: PriorityVector): Record<NumericDomain, number> {
  const raw = Object.fromEntries(NUMERIC_DOMAINS.map((domain) => [domain, new Decimal(0)])) as Record<NumericDomain, Decimal>;
  for (const factor of Object.keys(priorityVector) as PriorityFactor[]) {
    const factorWeight = new Decimal(priorityVector[factor]);
    const allocation = DOMAIN_ALLOCATION[factor];
    for (const domain of NUMERIC_DOMAINS) {
      const share = allocation[domain] ?? 0;
      if (share !== 0) raw[domain] = raw[domain].plus(factorWeight.mul(share));
    }
  }
  const effective = Object.fromEntries(NUMERIC_DOMAINS.map((domain) => [domain, raw[domain].plus(BASE_DOMAIN_WEIGHT)])) as Record<NumericDomain, Decimal>;
  const total = NUMERIC_DOMAINS.reduce((acc, domain) => acc.plus(effective[domain]), new Decimal(0));
  return roundToSumOne(NUMERIC_DOMAINS.map((domain) => ({ key: domain, value: effective[domain].div(total) })));
}

export function computeDimensionWeights(domainWeights: Record<NumericDomain, number>, activeDimensionKeys: Iterable<string>): Record<string, number> {
  const active = new Set(activeDimensionKeys);
  const weights: Record<string, number> = {};
  for (const domain of NUMERIC_DOMAINS) {
    const dimensions = DOMAIN_DIMENSIONS[domain].filter((key) => active.has(key));
    if (dimensions.length === 0) continue;
    const share = new Decimal(domainWeights[domain]).div(dimensions.length);
    for (const key of dimensions) weights[key] = share.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  }
  return weights;
}

function roundToSumOne(items: Array<{ key: string; value: Decimal }>): Record<string, number> {
  const entries = items.map((item) => ({ key: item.key, value: item.value, rounded: item.value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber() }));
  const sum = entries.reduce((acc, entry) => acc + entry.rounded, 0);
  const diffUnits = Math.round((1 - sum) * 10000);
  if (diffUnits !== 0) {
    let index = 0;
    let bestRemainder = -Infinity;
    entries.forEach((entry, i) => {
      const remainder = entry.value.minus(entry.rounded).toNumber();
      if (remainder > bestRemainder) {
        bestRemainder = remainder;
        index = i;
      }
    });
    entries[index]!.rounded = Math.round((entries[index]!.rounded + diffUnits * 0.0001) * 10000) / 10000;
  }
  return Object.fromEntries(entries.map((entry) => [entry.key, entry.rounded]));
}
