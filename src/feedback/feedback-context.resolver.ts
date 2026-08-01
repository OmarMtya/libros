import { Injectable } from '@nestjs/common';
import { DIMENSIONS, FEEDBACK_MAPPINGS } from '../profile/catalog';

export type FeedbackVerdict = 'ready' | 'needs_review' | 'needs_clarification' | 'stored_without_book_context' | 'commercial_only';

export type VerdictInput = {
  started: boolean;
  hasAspects: boolean;
  hasRecognizedAspects: boolean;
  classificationApproved: boolean;
  requiredFeaturesPresent: boolean;
};

export function deriveVerdict(input: VerdictInput): FeedbackVerdict {
  if (!input.started) return 'commercial_only';
  if (!input.classificationApproved) return 'needs_review';
  if (!input.hasAspects) return 'needs_clarification';
  if (!input.hasRecognizedAspects) return 'needs_review';
  if (!input.requiredFeaturesPresent) return 'needs_review';
  return 'ready';
}

export function learningStatusFor(verdict: FeedbackVerdict): { learningStatus: 'pending_processing' | 'processed' | 'needs_review' | 'needs_clarification'; processingOutcome: string | null } {
  switch (verdict) {
    case 'commercial_only':
      return { learningStatus: 'processed', processingOutcome: 'commercial_only' };
    case 'ready':
      return { learningStatus: 'pending_processing', processingOutcome: null };
    case 'needs_review':
      return { learningStatus: 'needs_review', processingOutcome: null };
    case 'needs_clarification':
      return { learningStatus: 'needs_clarification', processingOutcome: null };
    default:
      return { learningStatus: 'needs_clarification', processingOutcome: null };
  }
}

const dimensionByKey = new Map(DIMENSIONS.map((dimension) => [dimension.key, dimension]));

const RECOGNIZED_ASPECT_KEYS = new Set<string>([
  ...Object.keys(FEEDBACK_MAPPINGS.positive),
  ...Object.keys(FEEDBACK_MAPPINGS.negative),
]);

export function mappingBookFeatureKeys(polarity: 'positive' | 'negative', aspectKeys: string[]): Set<string> {
  const keys = new Set<string>();
  for (const aspectKey of aspectKeys) {
    for (const mapping of FEEDBACK_MAPPINGS[polarity][aspectKey] ?? []) {
      if (!mapping.dimensionKey) continue;
      const bookFeatureKey = dimensionByKey.get(mapping.dimensionKey)?.bookFeatureKey;
      if (bookFeatureKey) keys.add(bookFeatureKey);
    }
  }
  return keys;
}

export type FeedbackContext = {
  feedbackId: string;
  assignmentId: string;
  invitationId: string;
  book: { id: string; canonicalTitle: string; originalLanguage: string };
  edition: { id: string; title: string; languageCode: string };
  classification: { id: string; revision: number; classifierVersion: string; status: string; featureSchemaVersion: string; contentTypeKey: string };
  features: Record<string, { value: number; confidence: number }>;
  tags: Record<string, { strength: number; confidence: number }>;
  readingProgress: { started: boolean; completionPercentage: number; readingStatus: string };
  outcomeAttribution: string | null;
  verdict: FeedbackVerdict;
};

type AssignmentForContext = {
  id: string;
  edition: {
    id: string;
    title: string;
    languageCode: string;
    book: { id: string; canonicalTitle: string; originalLanguage: string };
  };
  classification: {
    id: string;
    revision: number;
    classifierVersion: string;
    status: string;
    featureSchemaVersion: string;
    contentTypeKey: string;
    features: Array<{ featureKey: string; value: unknown; confidence: unknown }>;
    tags: Array<{ tagKey: string; strength: unknown; confidence: unknown }>;
  };
};

@Injectable()
export class FeedbackContextResolver {
  resolve(feedback: { id: string; started: boolean; completionPercentage: number; readingStatus: string; outcomeAttribution: string | null; positiveAspects?: { optionKey: string }[]; negativeAspects?: { optionKey: string }[] }, invitationId: string, assignment: AssignmentForContext): FeedbackContext {
    const classification = assignment.classification;
    const positiveAspects = feedback.positiveAspects?.map((aspect) => aspect.optionKey) ?? [];
    const negativeAspects = feedback.negativeAspects?.map((aspect) => aspect.optionKey) ?? [];
    const aspectKeys = [...positiveAspects, ...negativeAspects];
    const hasAspects = aspectKeys.length > 0;
    const hasRecognizedAspects = hasAspects && aspectKeys.every((key) => RECOGNIZED_ASPECT_KEYS.has(key));
    const requiredFeatures = new Set<string>([
      ...mappingBookFeatureKeys('positive', positiveAspects),
      ...mappingBookFeatureKeys('negative', negativeAspects),
    ]);
    const presentFeatures = new Set(classification.features.map((feature) => feature.featureKey));
    const requiredFeaturesPresent = [...requiredFeatures].every((featureKey) => presentFeatures.has(featureKey));

    const verdict = deriveVerdict({
      started: feedback.started,
      hasAspects,
      hasRecognizedAspects,
      classificationApproved: classification.status === 'approved',
      requiredFeaturesPresent,
    });

    return {
      feedbackId: feedback.id,
      assignmentId: assignment.id,
      invitationId,
      book: assignment.edition.book,
      edition: { id: assignment.edition.id, title: assignment.edition.title, languageCode: assignment.edition.languageCode },
      classification: {
        id: classification.id,
        revision: classification.revision,
        classifierVersion: classification.classifierVersion,
        status: classification.status,
        featureSchemaVersion: classification.featureSchemaVersion,
        contentTypeKey: classification.contentTypeKey,
      },
      features: Object.fromEntries(classification.features.map((feature) => [feature.featureKey, { value: Number(feature.value), confidence: Number(feature.confidence) }])),
      tags: Object.fromEntries(classification.tags.map((tag) => [tag.tagKey, { strength: Number(tag.strength), confidence: Number(tag.confidence) }])),
      readingProgress: { started: feedback.started, completionPercentage: feedback.completionPercentage, readingStatus: feedback.readingStatus },
      outcomeAttribution: feedback.outcomeAttribution,
      verdict,
    };
  }
}
