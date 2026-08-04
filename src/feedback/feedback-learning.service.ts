import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileDescriptionService } from '../profile/profile-description.service';
import { ProfileService } from '../profile/profile.service';
import { EvidenceFactory, EvidenceInput } from '../profile/evidence.factory';
import { round4 } from '../scoring/compatibility';
import { ATTRIBUTION_FACTORS, EXPOSURE_FACTORS } from '../profile/catalog';
import { FEEDBACK_LEARNING_MAPPINGS, LearningOperation, observedValueFor } from './feedback-learning-mappings';
import { extractExplicitTagMentions, TagTerm } from './explicit-tag-mentions';
import { deriveTagPreferences, tagEvidenceFingerprint } from './feedback-tag-preferences';

const TAG_BASE_WEIGHT = 0.6;
const TAG_ADJUSTMENT = 0.25;
const TAG_REASON_CODE = 'feedback_explicit_tag';
const TAG_MAPPING_VERSION = 'feedback-tag/1.0';
const DIMENSION_SPECIFICITY = 0.8;

type FeedbackWithContext = {
  id: string;
  userId: string;
  bookId: string | null;
  bookEditionId: string | null;
  bookClassificationVersionId: string | null;
  freeText: string | null;
  completionPercentage: number;
  readingStatus: string;
  outcomeAttribution: string | null;
  learningStatus: string;
  aspects: Array<{ polarity: string; optionKey: string }>;
  classification: { features: Array<{ featureKey: string; value: Prisma.Decimal; confidence: Prisma.Decimal }> } | null;
};

@Injectable()
export class FeedbackLearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
    private readonly evidenceFactory: EvidenceFactory,
    private readonly descriptions: ProfileDescriptionService,
  ) {}

  async process(feedbackId: string) {
    const feedback = await this.prisma.readingFeedback.findUnique({
      where: { id: feedbackId },
      include: {
        aspects: true,
        classification: { include: { features: true } },
      },
    });
    if (!feedback) throw new NotFoundException('No se encontró el feedback.');
    if (feedback.learningStatus === 'processed') {
      return { feedback, learningStatus: 'processed', recompute: null };
    }
    if (feedback.learningStatus !== 'pending_processing') {
      return { feedback, learningStatus: feedback.learningStatus, recompute: null };
    }

    const profile = await this.profiles.ensureProfile(feedback.userId);
    const evidenceInputs = this.dimensionEvidence(feedback);
    const tagEvidenceRows = await this.tagEvidence(feedback, profile.id);
    const learnedWithout = evidenceInputs.length === 0 && tagEvidenceRows.length === 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (evidenceInputs.length > 0) {
          await this.evidenceFactory.createMany(tx, {
            userId: feedback.userId,
            profileId: profile.id,
            sourceType: 'reading_feedback',
            sourceId: feedbackId,
            bookId: feedback.bookId,
            evidence: evidenceInputs,
          });
        }
        for (const row of tagEvidenceRows) {
          await tx.readerTagEvidence.upsert({
            where: { evidenceFingerprint: row.evidenceFingerprint },
            create: row as Prisma.ReaderTagEvidenceUncheckedCreateInput,
            update: {},
          });
        }
        if (tagEvidenceRows.length > 0) {
          await deriveTagPreferences(tx, profile.id);
        }
        await tx.readingFeedback.update({
          where: { id: feedbackId },
          data: { learningStatus: 'processed', processingOutcome: learnedWithout ? 'learned_without_evidence' : 'learned', optimisticLockVersion: { increment: 1 } },
        });
      });

      await this.profiles.recompute(feedback.userId, 'feedback_learning', feedbackId);
      await this.descriptions.triggerGeneration(feedback.userId);
      const updated = await this.prisma.readingFeedback.findUniqueOrThrow({ where: { id: feedbackId } });
      return { feedback: updated, learningStatus: 'processed', recompute: null };
    } catch (error) {
      await this.prisma.readingFeedback.updateMany({
        where: { id: feedbackId, learningStatus: 'pending_processing' },
        data: { learningStatus: 'needs_review', processingOutcome: 'learning_failed' },
      });
      const updated = await this.prisma.readingFeedback.findUniqueOrThrow({ where: { id: feedbackId } });
      return { feedback: updated, learningStatus: updated.learningStatus, recompute: null };
    }
  }

  private dimensionEvidence(feedback: FeedbackWithContext): EvidenceInput[] {
    const inputs: EvidenceInput[] = [];
    const features = new Map((feedback.classification?.features ?? []).map((feature) => [feature.featureKey, feature]));
    const exposure = EXPOSURE_FACTORS[feedback.completionPercentage] ?? 1;
    const attribution = ATTRIBUTION_FACTORS[feedback.outcomeAttribution ?? 'no_problem'] ?? 1;
    const basePayload = {
      feedback_id: feedback.id,
      book_id: feedback.bookId,
      book_edition_id: feedback.bookEditionId,
      book_classification_version_id: feedback.bookClassificationVersionId,
      completion_percentage: feedback.completionPercentage,
      reading_status: feedback.readingStatus,
      outcome_attribution: feedback.outcomeAttribution ?? null,
    };

    const collect = (aspectKeys: string[], polarity: 'positive' | 'negative') => {
      const direction = polarity === 'positive' ? 1 : -1;
      for (const aspectKey of aspectKeys) {
        for (const mapping of FEEDBACK_LEARNING_MAPPINGS[polarity][aspectKey] ?? []) {
          const bookFeature = features.get(mapping.bookFeatureKey);
          if (!bookFeature) continue;
          const observed = observedValueFor(mapping.operation as LearningOperation, bookFeature.value, mapping.margin);
          inputs.push({
            dimensionKey: mapping.targetDimension,
            observedValue: observed.toNumber(),
            reasonCode: mapping.reasonCode,
            baseWeight: mapping.baseWeight,
            direction,
            exposureFactor: exposure,
            specificityFactor: DIMENSION_SPECIFICITY,
            attributionFactor: attribution,
            rawPayload: {
              ...basePayload,
              aspect_key: aspectKey,
              polarity,
              book_feature_key: mapping.bookFeatureKey,
              book_value: bookFeature.value.toNumber(),
              operation: mapping.operation,
              margin: mapping.margin,
            },
          });
        }
      }
    };

    collect(feedback.aspects.filter((aspect) => aspect.polarity === 'positive').map((aspect) => aspect.optionKey), 'positive');
    collect(feedback.aspects.filter((aspect) => aspect.polarity === 'negative').map((aspect) => aspect.optionKey), 'negative');
    return inputs;
  }

  private async tagEvidence(feedback: FeedbackWithContext, profileId: string) {
    if (!feedback.freeText) return [] as Prisma.ReaderTagEvidenceUncheckedCreateInput[];
    const tags = await this.prisma.tagVersion.findMany({ where: { status: 'active' }, select: { tagKey: true, name: true, aliasesJson: true } });
    const terms: TagTerm[] = tags.map((tag) => ({
      tagKey: tag.tagKey,
      name: tag.name,
      aliases: Array.isArray(tag.aliasesJson) ? tag.aliasesJson.filter((alias): alias is string => typeof alias === 'string') : [],
    }));
    const mentions = extractExplicitTagMentions(feedback.freeText, terms);
    if (mentions.length === 0) return [] as Prisma.ReaderTagEvidenceUncheckedCreateInput[];

    const exposure = EXPOSURE_FACTORS[feedback.completionPercentage] ?? 1;
    const attribution = ATTRIBUTION_FACTORS[feedback.outcomeAttribution ?? 'no_problem'] ?? 1;
    const finalWeight = round4(TAG_BASE_WEIGHT * exposure * attribution);

    const rows: Prisma.ReaderTagEvidenceUncheckedCreateInput[] = [];
    for (const mention of mentions) {
      if (mention.polarity === 0) continue;
      const adjustment = mention.polarity > 0 ? TAG_ADJUSTMENT : -TAG_ADJUSTMENT;
      const rawPayload = {
        feedback_id: feedback.id,
        book_id: feedback.bookId,
        book_edition_id: feedback.bookEditionId,
        book_classification_version_id: feedback.bookClassificationVersionId,
        tag_key: mention.tagKey,
        matched_text: mention.matchedText,
        polarity: mention.polarity,
      };
      rows.push({
        userId: feedback.userId,
        profileId,
        sourceType: 'reading_feedback',
        sourceId: feedback.id,
        feedbackId: feedback.id,
        bookId: feedback.bookId,
        bookEditionId: feedback.bookEditionId,
        bookClassificationVersionId: feedback.bookClassificationVersionId,
        tagKey: mention.tagKey,
        adjustment,
        direction: mention.polarity,
        baseWeight: TAG_BASE_WEIGHT,
        finalWeight: finalWeight.toNumber(),
        reasonCode: TAG_REASON_CODE,
        mappingVersion: TAG_MAPPING_VERSION,
        rawPayload: rawPayload as Prisma.InputJsonValue,
        evidenceFingerprint: tagEvidenceFingerprint('reading_feedback', feedback.id, mention.tagKey, TAG_REASON_CODE, adjustment, rawPayload),
        status: 'active',
      });
    }
    return rows;
  }
}
