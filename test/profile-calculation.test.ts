import { describe, expect, it } from 'vitest';
import { FEEDBACK_MAPPINGS } from '../src/profile/catalog';
import { aggregateDimension, canonicalJson, evidenceSetHash } from '../src/profile/profile-calculation';

describe('profile aggregation', () => {
  it('calculates the documented first-answer confidence', () => {
    const result = aggregateDimension([{ dimensionKey: 'hook_need', observedValue: 0.75, finalWeight: 0.6, sourceType: 'questionnaire_answer', sourceId: 'answer-1', createdAt: new Date('2026-01-01T00:00:00Z') }]);

    expect(result.value?.toFixed(4)).toBe('0.7500');
    expect(result.confidence.toFixed(4)).toBe('0.1813');
    expect(result.evidenceCount).toBe(1);
    expect(result.totalEvidenceWeight.toFixed(4)).toBe('0.6000');
  });

  it('lowers confidence when weighted observations contradict each other', () => {
    const consistent = aggregateDimension([
      { dimensionKey: 'hook_need', observedValue: 0.75, finalWeight: 0.6, sourceType: 'questionnaire_answer', sourceId: 'a', createdAt: new Date() },
      { dimensionKey: 'hook_need', observedValue: 0.8, finalWeight: 0.6, sourceType: 'questionnaire_answer', sourceId: 'b', createdAt: new Date() },
    ]);
    const contradictory = aggregateDimension([
      { dimensionKey: 'hook_need', observedValue: 0.1, finalWeight: 0.6, sourceType: 'questionnaire_answer', sourceId: 'a', createdAt: new Date() },
      { dimensionKey: 'hook_need', observedValue: 0.9, finalWeight: 0.6, sourceType: 'questionnaire_answer', sourceId: 'b', createdAt: new Date() },
    ]);

    expect(contradictory.confidence.lessThan(consistent.confidence)).toBe(true);
  });

  it('uses an order-independent fingerprint set hash and canonical JSON', () => {
    expect(evidenceSetHash(['b', 'a'])).toBe(evidenceSetHash(['a', 'b']));
    expect(canonicalJson({ b: 1, a: { z: true, c: null } })).toBe('{"a":{"c":null,"z":true},"b":1}');
  });

  it('maps feedback to canonical dimension keys', () => {
    expect(FEEDBACK_MAPPINGS.negative.slow_without_payoff?.map((item) => item.dimensionKey)).toEqual(['slow_burn_tolerance', 'payoff_requirement']);
    expect(FEEDBACK_MAPPINGS.positive.ideas_reflection?.map((item) => item.dimensionKey)).toEqual(['conceptual_depth_appreciation', 'introspection_tolerance']);
  });
});
