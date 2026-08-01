import { describe, expect, it } from 'vitest';
import { deriveVerdict, learningStatusFor, mappingBookFeatureKeys } from '../src/feedback/feedback-context.resolver';

describe('deriveVerdict y learningStatusFor', () => {
  it('no iniciado → commercial_only → processed con processing_outcome commercial_only', () => {
    expect(deriveVerdict({ started: false, hasAspects: false, hasMappedAspects: false, classificationApproved: true, requiredFeaturesPresent: true })).toBe('commercial_only');
    expect(learningStatusFor('commercial_only')).toEqual({ learningStatus: 'processed', processingOutcome: 'commercial_only' });
  });

  it('clasificación no aprobada → needs_review', () => {
    expect(deriveVerdict({ started: true, hasAspects: true, hasMappedAspects: true, classificationApproved: false, requiredFeaturesPresent: true })).toBe('needs_review');
  });

  it('sin aspectos (ambiguo) → needs_clarification', () => {
    expect(deriveVerdict({ started: true, hasAspects: false, hasMappedAspects: false, classificationApproved: true, requiredFeaturesPresent: true })).toBe('needs_clarification');
  });

  it('aspectos sin mapping (p. ej. topic_no_interest) → needs_review', () => {
    expect(deriveVerdict({ started: true, hasAspects: true, hasMappedAspects: false, classificationApproved: true, requiredFeaturesPresent: true })).toBe('needs_review');
  });

  it('faltan features requeridas → needs_review', () => {
    expect(deriveVerdict({ started: true, hasAspects: true, hasMappedAspects: true, classificationApproved: true, requiredFeaturesPresent: false })).toBe('needs_review');
  });

  it('contexto completo → ready → pending_processing (nunca processed) mientras el stub devuelva []', () => {
    expect(deriveVerdict({ started: true, hasAspects: true, hasMappedAspects: true, classificationApproved: true, requiredFeaturesPresent: true })).toBe('ready');
    expect(learningStatusFor('ready')).toEqual({ learningStatus: 'pending_processing', processingOutcome: null });
  });
});

describe('mappingBookFeatureKeys', () => {
  it('style_too_simple consulta las features de estilo del libro', () => {
    const keys = mappingBookFeatureKeys('negative', ['style_too_simple']);
    expect(keys.has('style_clarity')).toBe(true);
    expect(keys.has('ornate_prose')).toBe(true);
  });

  it('topic_no_interest no produce features (sin mapping explícito)', () => {
    const keys = mappingBookFeatureKeys('negative', ['topic_no_interest']);
    expect(keys.size).toBe(0);
  });
});
