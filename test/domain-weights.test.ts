import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { computeDimensionWeights, computeDomainWeights, NUMERIC_DOMAINS } from '../src/scoring/domain-weights';
import { buildPriorityVector } from '../src/scoring/priority-vector';

describe('computeDomainWeights', () => {
  it('normalizes numeric domain weights to sum 1.0000', () => {
    const weights = computeDomainWeights(buildPriorityVector(['characters', 'atmosphere', 'plot']));
    const sum = NUMERIC_DOMAINS.reduce((acc, domain) => acc + weights[domain], 0);
    expect(Math.round(sum * 10000) / 10000).toBe(1);
    expect(NUMERIC_DOMAINS.every((domain) => weights[domain] > 0)).toBe(true);
  });

  it('gives the characters domain the most weight when characters is first', () => {
    const weights = computeDomainWeights(buildPriorityVector(['characters', 'atmosphere', 'plot']));
    const entries = NUMERIC_DOMAINS.map((domain) => ({ domain, weight: weights[domain] })).sort((a, b) => b.weight - a.weight);
    expect(entries[0]!.domain).toBe('characters_relationships');
  });

  it('changes domain weights when the priority order changes', () => {
    const charactersFirst = computeDomainWeights(buildPriorityVector(['characters', 'atmosphere', 'plot']));
    const plotFirst = computeDomainWeights(buildPriorityVector(['plot', 'atmosphere', 'characters']));
    expect(charactersFirst.characters_relationships).not.toBe(plotFirst.characters_relationships);
    expect(charactersFirst.narrative_pacing).toBeLessThan(plotFirst.narrative_pacing);
  });

  it('reflects the Borda share into every allocated domain', () => {
    const weights = computeDomainWeights(buildPriorityVector(['style', 'emotion', 'ideas']));
    expect(weights.style_voice).toBeGreaterThan(weights.emotional_experience);
  });
});

describe('computeDimensionWeights', () => {
  it('divides each domain weight among its active dimensions', () => {
    const domainWeights = computeDomainWeights(buildPriorityVector(['characters', 'atmosphere', 'plot']));
    const active = ['character_depth_need', 'character_likability_need', 'style_clarity_preference'];
    const dimensionWeights = computeDimensionWeights(domainWeights, active);
    expect(dimensionWeights.character_depth_need).toBeCloseTo(domainWeights.characters_relationships / 2, 4);
    expect(dimensionWeights.style_clarity_preference).toBeCloseTo(domainWeights.style_voice, 4);
  });

  it('skips domains without active dimensions', () => {
    const domainWeights = computeDomainWeights(buildPriorityVector(['characters', 'atmosphere', 'plot']));
    const dimensionWeights = computeDimensionWeights(domainWeights, ['style_clarity_preference']);
    expect(Object.keys(dimensionWeights)).toEqual(['style_clarity_preference']);
  });

  it('produces weights with decimal arithmetic matching the spec tolerance', () => {
    const domainWeights = computeDomainWeights(buildPriorityVector(['characters', 'atmosphere', 'plot']));
    const dimensionWeights = computeDimensionWeights(domainWeights, ['tension_preference', 'comfort_preference', 'humor_preference']);
    const share = new Decimal(domainWeights.emotional_experience).div(3);
    expect(Math.abs(dimensionWeights.tension_preference! - share.toNumber())).toBeLessThanOrEqual(0.0001);
  });
});
