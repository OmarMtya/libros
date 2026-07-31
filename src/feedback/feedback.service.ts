import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ATTRIBUTION_FACTORS, EXPOSURE_FACTORS, FEEDBACK_MAPPINGS } from '../profile/catalog';
import { EvidenceFactory, EvidenceInput } from '../profile/evidence.factory';
import { ProfileService } from '../profile/profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitFeedbackDto } from './feedback.dto';

const POSITIVE_WITHOUT_DIMENSION = new Set(['length', 'nothing_in_particular', 'other']);
const NEGATIVE_WITHOUT_DIMENSION = new Set(['topic_no_interest', 'length_problem', 'other']);

@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
    private readonly evidenceFactory: EvidenceFactory,
  ) {}

  async submit(userId: string, dto: SubmitFeedbackDto) {
    this.validate(dto);
    if (dto.idempotencyKey) {
      const existing = await this.prisma.readingFeedback.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: dto.idempotencyKey } } });
      if (existing) return { feedback: existing, recompute: await this.profiles.recompute(userId, 'feedback_retry', existing.id) };
    }
    const profile = await this.profiles.ensureProfile(userId);
    const feedback = await this.prisma.$transaction(async (tx) => {
      const created = await tx.readingFeedback.create({
        data: {
          userId,
          bookId: dto.bookId ?? null,
          recommendationId: dto.recommendationId ?? null,
          feedbackVersion: 'feedback/1.0',
          started: dto.started,
          notStartedReason: dto.notStartedReason ?? null,
          readingStatus: dto.readingStatus,
          completionPercentage: dto.completionPercentage,
          selectionFitRating: dto.selectionFitRating ?? null,
          outcomeAttribution: dto.outcomeAttribution ?? null,
          nextDirectionJson: dto.nextDirection as Prisma.InputJsonValue ?? Prisma.JsonNull,
          freeText: dto.freeText ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
          aspects: { create: [
            ...(dto.positiveAspects ?? []).map((optionKey) => ({ polarity: 'positive', optionKey })),
            ...(dto.negativeAspects ?? []).map((optionKey) => ({ polarity: 'negative', optionKey })),
          ] },
        },
      });
      await this.evidenceFactory.createMany(tx, {
        userId,
        profileId: profile.id,
        sourceType: 'reading_feedback',
        sourceId: created.id,
        bookId: dto.bookId ?? null,
        evidence: this.toEvidence(dto),
      });
      return created;
    });
    const recompute = await this.profiles.recompute(userId, 'reading_feedback', feedback.id);
    return { feedback, recompute };
  }

  private validate(dto: SubmitFeedbackDto) {
    if (!dto.started && (dto.readingStatus !== 'not_started' || dto.completionPercentage !== 0 || !dto.notStartedReason)) throw new BadRequestException('A book not started must include its reason, status not_started, and 0% completion.');
    if (dto.started && dto.readingStatus === 'not_started') throw new BadRequestException('A started book cannot have status not_started.');
    if (dto.readingStatus === 'completed' && dto.completionPercentage !== 100) throw new BadRequestException('Completed feedback must have 100% completion.');
    if (!Object.hasOwn(EXPOSURE_FACTORS, dto.completionPercentage)) throw new BadRequestException('Completion percentage must be one of 0, 5, 18, 38, 63, 88, or 100.');
    const invalidPositive = (dto.positiveAspects ?? []).filter((key) => !FEEDBACK_MAPPINGS.positive[key] && !POSITIVE_WITHOUT_DIMENSION.has(key));
    const invalidNegative = (dto.negativeAspects ?? []).filter((key) => !FEEDBACK_MAPPINGS.negative[key] && !NEGATIVE_WITHOUT_DIMENSION.has(key));
    if (invalidPositive.length || invalidNegative.length) throw new BadRequestException({ message: 'Unknown feedback aspect.', invalidPositive, invalidNegative });
  }

  private toEvidence(dto: SubmitFeedbackDto): EvidenceInput[] {
    const exposureFactor = EXPOSURE_FACTORS[dto.completionPercentage]!;
    const attributionFactor = ATTRIBUTION_FACTORS[dto.outcomeAttribution ?? 'no_problem']!;
    const payload = { feedback_version: 'feedback/1.0', completion_percentage: dto.completionPercentage, outcome_attribution: dto.outcomeAttribution ?? 'no_problem' };
    return [
      ...(dto.positiveAspects ?? []).flatMap((key) => FEEDBACK_MAPPINGS.positive[key] ?? []).map((mapping) => ({ ...mapping, exposureFactor, specificityFactor: 0.8, attributionFactor, rawPayload: { ...payload, aspect: mapping.reasonCode, polarity: 'positive' } })),
      ...(dto.negativeAspects ?? []).flatMap((key) => FEEDBACK_MAPPINGS.negative[key] ?? []).map((mapping) => ({ ...mapping, exposureFactor, specificityFactor: 0.8, attributionFactor, rawPayload: { ...payload, aspect: mapping.reasonCode, polarity: 'negative' } })),
    ];
  }
}
