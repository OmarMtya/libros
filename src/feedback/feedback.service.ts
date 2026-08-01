import { Injectable } from '@nestjs/common';
import { FulfillmentStatus, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitFeedbackDto } from './feedback.dto';
import { isFinalFeedback, validateFeedbackPayload } from './feedback-validation';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(userId: string, dto: SubmitFeedbackDto) {
    validateFeedbackPayload(dto);
    if (dto.idempotencyKey) {
      const existing = await this.prisma.readingFeedback.findFirst({
        where: { userId, idempotencyKey: dto.idempotencyKey },
        orderBy: { submittedAt: 'desc' },
      });
      if (existing) return { feedback: existing, learningStatus: existing.learningStatus, recompute: null };
    }
    const normalized = {
      started: dto.started,
      readingStatus: dto.readingStatus,
      completionPercentage: dto.completionPercentage,
      notStartedReason: dto.notStartedReason ?? null,
      selectionFitRating: dto.selectionFitRating ?? null,
      outcomeAttribution: dto.outcomeAttribution ?? null,
      positiveAspects: dto.positiveAspects ?? [],
      negativeAspects: dto.negativeAspects ?? [],
    };
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        userId,
        status: { notIn: [OrderStatus.cancelled, OrderStatus.refunded] },
        fulfillment: { is: { status: { not: FulfillmentStatus.canceled } } },
      },
      select: { id: true, fulfillment: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const feedback = await this.prisma.readingFeedback.create({
      data: {
        userId,
        orderId: activeOrder?.id ?? null,
        fulfillmentId: activeOrder?.fulfillment?.id ?? null,
        feedbackVersion: 'feedback/1.0',
        started: dto.started,
        notStartedReason: dto.notStartedReason ?? null,
        readingStatus: dto.readingStatus,
        completionPercentage: dto.completionPercentage,
        selectionFitRating: dto.selectionFitRating ?? null,
        outcomeAttribution: dto.outcomeAttribution ?? null,
        nextDirectionJson: (dto.nextDirection as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        freeText: dto.freeText ?? null,
        rawResponse: dto as unknown as Prisma.InputJsonValue,
        normalizedResponse: normalized as Prisma.InputJsonValue,
        idempotencyKey: dto.idempotencyKey ?? null,
        learningStatus: 'stored_without_book_context',
        isFinal: isFinalFeedback(dto.readingStatus),
        aspects: {
          create: [
            ...(dto.positiveAspects ?? []).map((optionKey) => ({ polarity: 'positive', optionKey })),
            ...(dto.negativeAspects ?? []).map((optionKey) => ({ polarity: 'negative', optionKey })),
          ],
        },
      },
    });
    return { feedback, learningStatus: feedback.learningStatus, recompute: null };
  }
}
