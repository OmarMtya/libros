import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FeedbackContextResolver, learningStatusFor } from './feedback-context.resolver';
import { FeedbackInvitationService } from './feedback-invitation.service';
import { FeedbackLearningService } from './feedback-learning.service';
import { SubmitFeedbackByTokenDto } from './feedback.dto';
import { isFinalFeedback, validateFeedbackPayload } from './feedback-validation';

type LockedInvitation = {
  id: string;
  curation_assignment_id: string;
  status: string;
  expires_at: Date | null;
};

const ASSIGNMENT_INCLUDE = {
  fulfillment: {
    select: {
      orderId: true,
      status: true,
      order: { select: { userId: true } },
    },
  },
  edition: {
    include: {
      book: { select: { id: true, canonicalTitle: true, originalLanguage: true } },
      contributors: { include: { author: { select: { canonicalName: true } } }, orderBy: { position: 'asc' as const } },
    },
  },
  classification: { include: { features: true, tags: true } },
} as const;

@Injectable()
export class FeedbackTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: FeedbackInvitationService,
    private readonly contextResolver: FeedbackContextResolver,
    private readonly learning: FeedbackLearningService,
  ) {}

  async resolveInvitation(token: string) {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await this.lockInvitation(tx, token);
      if (!invitation) throw new NotFoundException('La invitación no existe.');
      if (invitation.status === 'pending' && invitation.expires_at !== null && invitation.expires_at <= new Date()) {
        await tx.feedbackInvitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
        throw new NotFoundException('La invitación expiró.');
      }
      if (invitation.status === 'expired' || invitation.status === 'revoked') throw new NotFoundException('La invitación ya no es válida.');
      const assignment = await tx.curationAssignment.findUnique({
        where: { id: invitation.curation_assignment_id },
        include: ASSIGNMENT_INCLUDE,
      });
      if (!assignment) throw new NotFoundException('La invitación no tiene una asignación válida.');
      if (assignment.fulfillment.status !== 'delivered') {
        throw new BadRequestException('El libro aún no ha sido entregado.');
      }
      const authors = await tx.bookAuthor.findMany({
        where: { bookId: assignment.edition.bookId },
        include: { author: { select: { canonicalName: true } } },
        orderBy: { position: 'asc' },
      });
      const existingFeedback = await tx.readingFeedback.findFirst({
        where: { curationAssignmentId: assignment.id },
        orderBy: { submittedAt: 'desc' },
        select: { id: true },
      });
      return {
        received: invitation.status === 'used' || existingFeedback !== null,
        book: {
          title: assignment.edition.book.canonicalTitle,
          editionTitle: assignment.edition.title,
          languageCode: assignment.edition.languageCode,
          authors: authors.map((item) => item.author.canonicalName),
          contributors: assignment.edition.contributors.map((contributor) => contributor.author.canonicalName),
        },
      };
    });
  }

  async submitByToken(token: string, dto: SubmitFeedbackByTokenDto, authenticatedUserId: string | null) {
    validateFeedbackPayload(dto);
    const result = await this.prisma.$transaction(async (tx) => {
      const invitation = await this.lockInvitation(tx, token);
      if (!invitation) throw new NotFoundException('La invitación no existe.');
      const now = new Date();
      if (invitation.status === 'pending' && invitation.expires_at !== null && invitation.expires_at <= now) {
        await tx.feedbackInvitation.update({ where: { id: invitation.id }, data: { status: 'expired' } });
        throw new NotFoundException('La invitación expiró.');
      }
      if (invitation.status === 'expired' || invitation.status === 'revoked') throw new NotFoundException('La invitación ya no es válida.');

      const existing = await tx.readingFeedback.findUnique({ where: { feedbackInvitationId: invitation.id } });
      if (existing) {
        if (existing.idempotencyKey === dto.idempotencyKey) return { feedback: existing, learningStatus: existing.learningStatus, recompute: null };
        throw new ConflictException('Esta invitación ya fue utilizada para enviar un feedback.');
      }
      if (invitation.status !== 'pending') throw new ConflictException('Esta invitación ya fue utilizada.');

      const assignment = await tx.curationAssignment.findUnique({
        where: { id: invitation.curation_assignment_id },
        include: ASSIGNMENT_INCLUDE,
      });
      if (!assignment) throw new NotFoundException('La invitación no tiene una asignación válida.');
      if (assignment.fulfillment.status !== 'delivered') {
        throw new BadRequestException('El libro aún no ha sido entregado.');
      }
      if (assignment.feedbackCycleStatus === 'final_received') throw new ConflictException('Ya se recibió el feedback final.');
      if (assignment.feedbackCycleStatus === 'closed_without_feedback') throw new ConflictException('El ciclo de aprendizaje está cerrado.');
      if (authenticatedUserId !== null && authenticatedUserId !== assignment.fulfillment.order.userId) {
        throw new ForbiddenException('Esta invitación pertenece a otro usuario.');
      }

      const isFinal = isFinalFeedback(dto.readingStatus);
      const notStartedReason = dto.started ? null : (dto.notStartedReason ?? null);
      const normalized = {
        started: dto.started,
        readingStatus: dto.readingStatus,
        completionPercentage: dto.completionPercentage,
        notStartedReason,
        selectionFitRating: dto.selectionFitRating ?? null,
        outcomeAttribution: dto.outcomeAttribution ?? null,
        positiveAspects: dto.positiveAspects ?? [],
        negativeAspects: dto.negativeAspects ?? [],
        isFinal,
      };

      const feedback = await tx.readingFeedback.create({
        data: {
          userId: assignment.fulfillment.order.userId,
          orderId: assignment.fulfillment.orderId,
          fulfillmentId: assignment.fulfillmentId,
          curationAssignmentId: assignment.id,
          bookId: assignment.edition.bookId,
          bookEditionId: assignment.edition.id,
          bookClassificationVersionId: assignment.classification.id,
          feedbackInvitationId: invitation.id,
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
          idempotencyKey: dto.idempotencyKey,
          learningStatus: 'pending_processing',
          isFinal,
          aspects: {
            create: [
              ...(dto.positiveAspects ?? []).map((optionKey) => ({ polarity: 'positive', optionKey })),
              ...(dto.negativeAspects ?? []).map((optionKey) => ({ polarity: 'negative', optionKey })),
            ],
          },
        },
        include: { aspects: true },
      });

      await tx.feedbackInvitation.update({ where: { id: invitation.id }, data: { status: 'used', usedAt: now, optimisticLockVersion: { increment: 1 } } });
      const nextCycle = isFinal ? 'final_received' : 'provisional_received';
      await tx.curationAssignment.update({ where: { id: assignment.id }, data: { feedbackCycleStatus: nextCycle, optimisticLockVersion: { increment: 1 } } });

      const context = this.contextResolver.resolve(
        {
          id: feedback.id,
          started: feedback.started,
          completionPercentage: feedback.completionPercentage,
          readingStatus: feedback.readingStatus,
          outcomeAttribution: feedback.outcomeAttribution,
          positiveAspects: feedback.aspects.filter((aspect) => aspect.polarity === 'positive'),
          negativeAspects: feedback.aspects.filter((aspect) => aspect.polarity === 'negative'),
        },
        invitation.id,
        assignment,
      );
      const { learningStatus, processingOutcome } = learningStatusFor(context.verdict);
      const updated = await tx.readingFeedback.update({
        where: { id: feedback.id },
        data: { learningStatus, processingOutcome },
        include: { aspects: true },
      });
      return { feedback: updated, context };
    });

    if (result.feedback.learningStatus === 'pending_processing') {
      const learned = await this.learning.process(result.feedback.id);
      return { feedback: learned.feedback, learningStatus: learned.learningStatus, recompute: learned.recompute, context: result.context };
    }
    return { feedback: result.feedback, learningStatus: result.feedback.learningStatus, recompute: null, context: result.context };
  }

  private async lockInvitation(tx: Prisma.TransactionClient, token: string): Promise<LockedInvitation | null> {
    const hash = this.invitations.hashToken(token);
    const rows = await tx.$queryRaw<LockedInvitation[]>(Prisma.sql`
      SELECT id, "curation_assignment_id", status, "expires_at"
      FROM "feedback_invitations"
      WHERE "token_hash" = ${hash}
      FOR UPDATE`);
    return rows[0] ?? null;
  }
}
