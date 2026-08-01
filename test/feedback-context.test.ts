import { describe, expect, it } from 'vitest';
import { deriveVerdict, FeedbackContextResolver, learningStatusFor, mappingBookFeatureKeys } from '../src/feedback/feedback-context.resolver';

describe('deriveVerdict y learningStatusFor', () => {
  it('no iniciado → commercial_only → processed con processing_outcome commercial_only', () => {
    expect(deriveVerdict({ started: false, hasAspects: false, hasRecognizedAspects: false, classificationApproved: true, requiredFeaturesPresent: true })).toBe('commercial_only');
    expect(learningStatusFor('commercial_only')).toEqual({ learningStatus: 'processed', processingOutcome: 'commercial_only' });
  });

  it('clasificación no aprobada → needs_review', () => {
    expect(deriveVerdict({ started: true, hasAspects: true, hasRecognizedAspects: true, classificationApproved: false, requiredFeaturesPresent: true })).toBe('needs_review');
  });

  it('sin aspectos (ambiguo) → needs_clarification', () => {
    expect(deriveVerdict({ started: true, hasAspects: false, hasRecognizedAspects: false, classificationApproved: true, requiredFeaturesPresent: true })).toBe('needs_clarification');
  });

  it('aspectos no reconocidos (p. ej. clave desconocida) → needs_review', () => {
    expect(deriveVerdict({ started: true, hasAspects: true, hasRecognizedAspects: false, classificationApproved: true, requiredFeaturesPresent: true })).toBe('needs_review');
  });

  it('faltan features requeridas → needs_review', () => {
    expect(deriveVerdict({ started: true, hasAspects: true, hasRecognizedAspects: true, classificationApproved: true, requiredFeaturesPresent: false })).toBe('needs_review');
  });

  it('contexto completo → ready → pending_processing (nunca processed) mientras el stub devuelva []', () => {
    expect(deriveVerdict({ started: true, hasAspects: true, hasRecognizedAspects: true, classificationApproved: true, requiredFeaturesPresent: true })).toBe('ready');
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

  it('tension_curiosity solo requiere tension_level (nunca strangeness_level)', () => {
    const keys = mappingBookFeatureKeys('positive', ['tension_curiosity']);
    expect([...keys]).toEqual(['tension_level']);
    expect(keys.has('strangeness_level')).toBe(false);
  });

  it('atmosphere es un aspecto reconocido pero no exige ninguna feature', () => {
    const keys = mappingBookFeatureKeys('positive', ['atmosphere']);
    expect(keys.size).toBe(0);
    expect(keys.has('descriptive_density')).toBe(false);
  });
});

describe('FeedbackContextResolver.resolve', () => {
  const resolver = new FeedbackContextResolver();

  const classification = (featureKeys: string[]) => ({
    id: 'cl-1',
    revision: 1,
    classifierVersion: 'book-tax/1.1.0',
    status: 'approved',
    featureSchemaVersion: 'book-feature/1.0',
    contentTypeKey: 'fiction',
    features: featureKeys.map((featureKey) => ({ featureKey, value: 0.7, confidence: 0.6 })),
    tags: [],
  });

  const assignment = (featureKeys: string[]) => ({
    id: 'a-1',
    edition: { id: 'e-1', title: 'Libro', languageCode: 'es', book: { id: 'b-1', canonicalTitle: 'Libro', originalLanguage: 'es' } },
    classification: classification(featureKeys),
  });

  const feedbackFor = (positiveAspects: string[], negativeAspects: string[] = []) => ({
    id: 'fb-1',
    started: true,
    completionPercentage: 100,
    readingStatus: 'completed',
    outcomeAttribution: null,
    positiveAspects: positiveAspects.map((optionKey) => ({ optionKey })),
    negativeAspects: negativeAspects.map((optionKey) => ({ optionKey })),
  });

  it('un feedback solo con atmosphere → ready (sin exigir descriptive_density)', () => {
    const context = resolver.resolve(feedbackFor(['atmosphere']), 'inv-1', assignment([]));
    expect(context.verdict).toBe('ready');
  });

  it('atmosphere combinado con tension_curiosity → ready y requiere tension_level', () => {
    const context = resolver.resolve(feedbackFor(['atmosphere', 'tension_curiosity']), 'inv-1', assignment(['tension_level']));
    expect(context.verdict).toBe('ready');
  });

  it('atmosphere no exige descriptive_density aunque la clasificación no la tenga', () => {
    const context = resolver.resolve(feedbackFor(['atmosphere']), 'inv-1', assignment(['tension_level']));
    expect(context.verdict).toBe('ready');
  });

  it('un aspecto no reconocido sigue marcando needs_review', () => {
    const context = resolver.resolve(feedbackFor(['foobar']), 'inv-1', assignment(['descriptive_density']));
    expect(context.verdict).toBe('needs_review');
  });

  it('topic_no_interest (no reconocido por el catálogo) sigue marcando needs_review', () => {
    const context = resolver.resolve(feedbackFor([], ['topic_no_interest']), 'inv-1', assignment([]));
    expect(context.verdict).toBe('needs_review');
  });
});
