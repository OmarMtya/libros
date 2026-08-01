import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { FEEDBACK_LEARNING_MAPPINGS, observedValueFor, validateLearningMappings } from '../src/feedback/feedback-learning-mappings';

describe('FEEDBACK_LEARNING_MAPPINGS', () => {
  it('el catálogo pasa la validación semántica', () => {
    expect(validateLearningMappings()).toEqual([]);
  });

  it('style_too_simple produce ornate_prose_tolerance y linguistic_complexity_tolerance (no style_clarity_preference)', () => {
    const mappings = FEEDBACK_LEARNING_MAPPINGS.negative.style_too_simple!;
    expect(mappings.map((mapping) => mapping.targetDimension).sort()).toEqual(['linguistic_complexity_tolerance', 'ornate_prose_tolerance']);
    expect(mappings.every((mapping) => mapping.bookFeatureKey === 'ornate_prose' || mapping.bookFeatureKey === 'linguistic_complexity')).toBe(true);
  });

  it('cada optionKey expone una lista de mappings', () => {
    const mappings = FEEDBACK_LEARNING_MAPPINGS.positive.tension_curiosity!;
    expect(Array.isArray(mappings)).toBe(true);
    expect(mappings.length).toBe(1);
  });

  it('tension_curiosity solo aprende tension_preference y nunca strangeness_preference', () => {
    const mappings = FEEDBACK_LEARNING_MAPPINGS.positive.tension_curiosity!;
    const targets = mappings.map((mapping) => mapping.targetDimension);
    expect(targets).toEqual(['tension_preference']);
    expect(mappings[0]!.bookFeatureKey).toBe('tension_level');
    expect(targets).not.toContain('strangeness_preference');
    for (const polarity of ['positive', 'negative'] as const) {
      for (const optionKey of Object.keys(FEEDBACK_LEARNING_MAPPINGS[polarity])) {
        const optionMappings = FEEDBACK_LEARNING_MAPPINGS[polarity][optionKey] ?? [];
        expect(optionMappings.map((mapping) => mapping.targetDimension)).not.toContain('strangeness_preference');
      }
    }
  });

  it('aspectos sin dimensión (length, nothing_in_particular, topic_no_interest) no generan evidencia', () => {
    expect(FEEDBACK_LEARNING_MAPPINGS.positive['length'] ?? []).toEqual([]);
    expect(FEEDBACK_LEARNING_MAPPINGS.positive.nothing_in_particular ?? []).toEqual([]);
    expect(FEEDBACK_LEARNING_MAPPINGS.negative.topic_no_interest ?? []).toEqual([]);
  });

  it('atmosphere no genera evidencia dimensional (ni descriptive_density_preference)', () => {
    const mappings = FEEDBACK_LEARNING_MAPPINGS.positive.atmosphere!;
    expect(mappings).toEqual([]);
    const targets = FEEDBACK_LEARNING_MAPPINGS.positive.atmosphere!.map((mapping) => mapping.targetDimension);
    expect(targets).not.toContain('descriptive_density_preference');
  });
});

describe('observedValueFor', () => {
  it('prefer_above_book_value sube por encima del valor real', () => {
    expect(observedValueFor('prefer_above_book_value', 0.25, 0.15).toNumber()).toBe(0.4);
  });

  it('tolerance_below_failure_point baja del punto de fallo', () => {
    expect(observedValueFor('tolerance_below_failure_point', 0.85, 0.15).toNumber()).toBe(0.7);
  });

  it('reinforce_near_book_value usa el valor real del libro', () => {
    expect(observedValueFor('reinforce_near_book_value', 0.7, 0).toNumber()).toBe(0.7);
  });

  it('requirement_above_book_value sube el requisito sobre el valor del libro', () => {
    expect(observedValueFor('requirement_above_book_value', 0.6, 0.15).toNumber()).toBe(0.75);
  });

  it('clamp 0..1', () => {
    expect(observedValueFor('prefer_above_book_value', 0.95, 0.15).toNumber()).toBe(1);
    expect(observedValueFor('tolerance_below_failure_point', 0.05, 0.15).toNumber()).toBe(0);
  });

  it('si style_clarity=0.25 y el usuario dice “demasiado simple”, el observed queda por encima', () => {
    const mapping = FEEDBACK_LEARNING_MAPPINGS.negative.style_too_simple!.find((m) => m.targetDimension === 'ornate_prose_tolerance')!;
    const observed = observedValueFor(mapping.operation, new Decimal(0.25), mapping.margin);
    expect(observed.toNumber()).toBeGreaterThan(0.25);
  });
});
