import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FulfillmentStatus, Prisma } from '@prisma/client';
import { FeedbackInvitationService } from '../feedback/feedback-invitation.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignDto, ReplaceDto } from './curation.dto';
import { CuratorAuditService } from './curator-audit.service';

const LOGISTIC_FROZEN = new Set(['shipped', 'delivered', 'canceled']);

@Injectable()
export class CurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitations: FeedbackInvitationService,
    private readonly audit: CuratorAuditService,
  ) {}

  async listFulfillments(status?: string) {
    return this.prisma.fulfillment.findMany({
      where: status ? { status: status as FulfillmentStatus } : undefined,
      include: {
        order: {
          select: {
            id: true,
            userId: true,
            packageKey: true,
            packageName: true,
            status: true,
            createdAt: true,
            shippingAddress: true,
          },
        },
        assignments: {
          where: { status: 'active' },
          select: { id: true, feedbackCycleStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async assign(actorId: string, fulfillmentId: string, dto: AssignDto) {
    return this.prisma.$transaction(async (tx) => {
      const fulfillment = await tx.fulfillment.findUnique({ where: { id: fulfillmentId }, select: { id: true, status: true } });
      if (!fulfillment) throw new NotFoundException('No se encontró el fulfillment.');
      if (LOGISTIC_FROZEN.has(fulfillment.status)) throw new BadRequestException(`No se puede asignar con logística en estado ${fulfillment.status}.`);
      const active = await tx.curationAssignment.findFirst({ where: { fulfillmentId, status: 'active' }, select: { id: true } });
      if (active) throw new ConflictException('Este fulfillment ya tiene una asignación activa.');
      await this.assertAssignableClassification(tx, dto.bookEditionId, dto.classificationVersionId);

      const candidateId = await this.linkCandidate(tx, fulfillmentId, dto.bookEditionId, dto.classificationVersionId, dto.candidateId, dto.notes ?? dto.reason);

      const assignment = await tx.curationAssignment.create({
        data: {
          fulfillmentId,
          bookEditionId: dto.bookEditionId,
          classificationVersionId: dto.classificationVersionId,
          assignedBy: actorId,
          notes: dto.notes ?? null,
          recommendationCandidateId: candidateId ?? null,
        },
      });
      await tx.fulfillment.update({ where: { id: fulfillmentId }, data: { status: 'assigned' } });
      await this.audit.record(tx, {
        actorId,
        actionKind: 'assign_book',
        targetType: 'curation_assignment',
        targetId: assignment.id,
        reason: dto.reason ?? dto.notes ?? null,
        payloadDiffJson: { bookEditionId: dto.bookEditionId, classificationVersionId: dto.classificationVersionId, candidateId: candidateId ?? null },
      });
      return assignment;
    });
  }

  async replace(actorId: string, assignmentId: string, dto: ReplaceDto) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.curationAssignment.findUnique({ where: { id: assignmentId }, include: { fulfillment: { select: { id: true, status: true } } } });
      if (!current || current.status !== 'active') throw new ConflictException('No existe una asignación activa para reemplazar.');
      if (current.fulfillment.status === 'shipped' || current.fulfillment.status === 'delivered') {
        throw new BadRequestException('No se puede reemplazar la asignación después del envío.');
      }
      await this.assertAssignableClassification(tx, dto.bookEditionId, dto.classificationVersionId);

      const candidateId = await this.linkCandidate(tx, current.fulfillmentId, dto.bookEditionId, dto.classificationVersionId, dto.candidateId, dto.notes ?? dto.reason);

      const created = await tx.curationAssignment.create({
        data: {
          fulfillmentId: current.fulfillmentId,
          bookEditionId: dto.bookEditionId,
          classificationVersionId: dto.classificationVersionId,
          assignedBy: actorId,
          notes: dto.notes ?? null,
          recommendationCandidateId: candidateId ?? null,
        },
      });
      await tx.curationAssignment.update({ where: { id: assignmentId }, data: { status: 'replaced', replacedById: created.id, optimisticLockVersion: { increment: 1 } } });
      await this.audit.record(tx, {
        actorId,
        actionKind: 'replace_book',
        targetType: 'curation_assignment',
        targetId: created.id,
        reason: dto.reason ?? dto.notes ?? null,
        payloadDiffJson: { replacedAssignmentId: assignmentId, bookEditionId: dto.bookEditionId, classificationVersionId: dto.classificationVersionId, candidateId: candidateId ?? null },
      });
      return created;
    });
  }

  async pack(assignmentId: string) {
    return this.advanceLogistic(assignmentId, 'packed', ['assigned', 'packed'], 'pack_book');
  }

  async ship(assignmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.curationAssignment.findUnique({
        where: { id: assignmentId },
        include: { fulfillment: { select: { id: true, status: true } }, classification: { select: { status: true, bookEditionId: true } } },
      });
      if (!assignment || assignment.status !== 'active') throw new ConflictException('No existe una asignación activa.');
      if (assignment.classification.status !== 'approved') throw new BadRequestException('No se puede enviar sin una clasificación aprobada.');
      if (assignment.fulfillment.status !== 'assigned' && assignment.fulfillment.status !== 'packed') {
        throw new BadRequestException(`No se puede enviar desde el estado ${assignment.fulfillment.status}.`);
      }
      const now = new Date();
      await tx.fulfillment.update({ where: { id: assignment.fulfillmentId }, data: { status: 'shipped', shippedAt: now } });
      await tx.curationAssignment.update({ where: { id: assignmentId }, data: { feedbackCycleStatus: 'invited', optimisticLockVersion: { increment: 1 } } });
      const created = await this.invitations.createPending(tx, assignmentId, now);
      await this.audit.record(tx, {
        actorId: assignment.assignedBy,
        actionKind: 'send_book',
        targetType: 'curation_assignment',
        targetId: assignmentId,
        reason: null,
        payloadDiffJson: { invitationId: created.invitation.id },
      });
      return created;
    });
  }

  async delivered(assignmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.curationAssignment.findUnique({
        where: { id: assignmentId },
        include: { fulfillment: { select: { id: true, status: true } } },
      });
      if (!assignment || assignment.status !== 'active') throw new ConflictException('No existe una asignación activa.');
      if (assignment.fulfillment.status !== 'shipped') throw new BadRequestException('Solo se puede marcar entregada una logística enviada.');
      const updated = await tx.fulfillment.update({ where: { id: assignment.fulfillmentId }, data: { status: 'delivered', deliveredAt: new Date() } });
      await this.audit.record(tx, {
        actorId: assignment.assignedBy,
        actionKind: 'deliver_book',
        targetType: 'curation_assignment',
        targetId: assignmentId,
        reason: null,
        payloadDiffJson: {},
      });
      return updated;
    });
  }

  async closeWithoutFeedback(assignmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.curationAssignment.findUnique({
        where: { id: assignmentId },
        include: { fulfillment: { select: { id: true } }, feedbacks: { where: { isFinal: true }, select: { id: true } } },
      });
      if (!assignment) throw new NotFoundException('No se encontró la asignación.');
      if (assignment.feedbacks.length > 0) throw new ConflictException('Ya existe feedback final; no se puede cerrar sin feedback.');
      await tx.feedbackInvitation.updateMany({ where: { curationAssignmentId: assignmentId, status: 'pending' }, data: { status: 'revoked', revokedAt: new Date(), optimisticLockVersion: { increment: 1 } } });
      const updated = await tx.curationAssignment.update({ where: { id: assignmentId }, data: { feedbackCycleStatus: 'closed_without_feedback', optimisticLockVersion: { increment: 1 } } });
      await this.audit.record(tx, {
        actorId: assignment.assignedBy,
        actionKind: 'close_without_feedback',
        targetType: 'curation_assignment',
        targetId: assignmentId,
        reason: null,
        payloadDiffJson: {},
      });
      return updated;
    });
  }

  async reissueInvitation(assignmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.curationAssignment.findUnique({ where: { id: assignmentId }, select: { id: true, assignedBy: true, feedbackCycleStatus: true } });
      if (!assignment) throw new NotFoundException('No se encontró la asignación.');
      if (assignment.feedbackCycleStatus === 'final_received' || assignment.feedbackCycleStatus === 'closed_without_feedback') {
        throw new ConflictException(`No se puede reemitir una invitación con ciclo ${assignment.feedbackCycleStatus}. Usa reopen-learning para reabrirlo explícitamente.`);
      }
      const now = new Date();
      const pending = await tx.feedbackInvitation.findFirst({ where: { curationAssignmentId: assignmentId, status: 'pending' } });
      if (pending) {
        const nextStatus = pending.expiresAt <= now ? 'expired' : 'revoked';
        await tx.feedbackInvitation.update({
          where: { id: pending.id },
          data: { status: nextStatus, revokedAt: nextStatus === 'revoked' ? now : pending.revokedAt, optimisticLockVersion: { increment: 1 } },
        });
      }
      const created = await this.invitations.createPending(tx, assignmentId, now);
      await this.audit.record(tx, {
        actorId: assignment.assignedBy,
        actionKind: 'reissue_invitation',
        targetType: 'curation_assignment',
        targetId: assignmentId,
        reason: null,
        payloadDiffJson: { invitationId: created.invitation.id },
      });
      return { ...created, feedbackCycleStatus: assignment.feedbackCycleStatus };
    });
  }

  async reopenLearning(actorId: string, assignmentId: string, reason: string | undefined) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.curationAssignment.findUnique({ where: { id: assignmentId }, select: { id: true, notes: true, feedbackCycleStatus: true } });
      if (!assignment) throw new NotFoundException('No se encontró la asignación.');
      if (assignment.feedbackCycleStatus !== 'final_received' && assignment.feedbackCycleStatus !== 'closed_without_feedback') {
        throw new BadRequestException('El ciclo no está cerrado; usa reissue-invitation.');
      }
      const now = new Date();
      await tx.feedbackInvitation.updateMany({ where: { curationAssignmentId: assignmentId, status: 'pending' }, data: { status: 'revoked', revokedAt: now } });
      const notes = `Reapertura por ${actorId}: ${reason ?? 'sin motivo'} (previo: ${assignment.feedbackCycleStatus})`.slice(0, 500);
      await tx.curationAssignment.update({ where: { id: assignmentId }, data: { feedbackCycleStatus: 'invited', notes: notes, optimisticLockVersion: { increment: 1 } } });
      const created = await this.invitations.createPending(tx, assignmentId, now);
      await this.audit.record(tx, {
        actorId,
        actionKind: 'reopen_learning',
        targetType: 'curation_assignment',
        targetId: assignmentId,
        reason: reason ?? null,
        payloadDiffJson: { invitationId: created.invitation.id },
      });
      return created;
    });
  }

  async listAssignments(fulfillmentId?: string) {
    return this.prisma.curationAssignment.findMany({
      where: fulfillmentId ? { fulfillmentId } : undefined,
      include: {
        fulfillment: { include: { order: { select: { userId: true, status: true } } } },
        edition: { select: { id: true, title: true, languageCode: true } },
        classification: { select: { id: true, revision: true, status: true, classifierVersion: true } },
        recommendationCandidate: {
          select: { id: true, rankPosition: true, finalScore: true, recommendationEvidenceCoverage: true },
        },
        invitations: { orderBy: { createdAt: 'desc' } },
        feedbacks: { select: { id: true, learningStatus: true, isFinal: true, submittedAt: true } },
      },
      orderBy: { assignedAt: 'desc' },
      take: 100,
    });
  }

  private async linkCandidate(
    tx: Prisma.TransactionClient,
    fulfillmentId: string,
    bookEditionId: string,
    classificationVersionId: string,
    candidateId: string | undefined,
    reason: string | null | undefined,
  ): Promise<string | null> {
    const recommendation = await tx.recommendation.findFirst({ where: { fulfillmentId, isCurrent: true }, orderBy: { revision: 'desc' } });

    if (candidateId) {
      if (!recommendation) {
        throw new BadRequestException('El candidato no pertenece a la recomendación actual de este fulfillment.');
      }
      const candidate = await tx.recommendationCandidate.findUnique({ where: { id: candidateId }, select: { id: true, recommendationId: true, bookEditionId: true, classificationVersionId: true } });
      if (!candidate || candidate.recommendationId !== recommendation.id) {
        throw new BadRequestException('El candidato no pertenece a la recomendación actual de este fulfillment.');
      }
      if (candidate.bookEditionId !== bookEditionId || candidate.classificationVersionId !== classificationVersionId) {
        throw new BadRequestException('El candidato no corresponde a la edición y clasificación indicadas.');
      }
      if (recommendation.status !== 'selected') {
        await tx.recommendation.update({ where: { id: recommendation.id }, data: { status: 'selected' } });
      }
      return candidate.id;
    }

    if (!recommendation) return null;

    const override = await tx.recommendationCandidate.create({
      data: {
        recommendationId: recommendation.id,
        bookEditionId,
        classificationVersionId,
        rankPosition: null,
        reviewStatus: 'eligible',
        riskPenaltyBreakdownJson: {},
        weightDistributionJson: {},
        evaluationMetaJson: { override: true, reason: reason ?? null },
      },
    });
    if (recommendation.status !== 'selected') {
      await tx.recommendation.update({ where: { id: recommendation.id }, data: { status: 'selected' } });
    }
    return override.id;
  }

  private async assertAssignableClassification(tx: Prisma.TransactionClient, bookEditionId: string, classificationVersionId: string) {
    const classification = await tx.bookClassificationVersion.findUnique({ where: { id: classificationVersionId }, select: { bookEditionId: true, status: true } });
    if (!classification) throw new NotFoundException('No se encontró la clasificación.');
    if (classification.status !== 'approved') throw new BadRequestException('La clasificación debe estar aprobada para asignarse.');
    if (classification.bookEditionId !== bookEditionId) throw new BadRequestException('La clasificación no pertenece a la edición indicada.');
    const edition = await tx.bookEdition.findUnique({ where: { id: bookEditionId }, select: { id: true } });
    if (!edition) throw new NotFoundException('No se encontró la edición.');
  }

  private async advanceLogistic(assignmentId: string, target: 'packed' | 'delivered', allowed: string[], actionKind: string) {
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.curationAssignment.findUnique({
        where: { id: assignmentId },
        include: { fulfillment: { select: { id: true, status: true } } },
      });
      if (!assignment || assignment.status !== 'active') throw new ConflictException('No existe una asignación activa.');
      if (!allowed.includes(assignment.fulfillment.status)) throw new BadRequestException(`No se puede pasar a ${target} desde ${assignment.fulfillment.status}.`);
      const data = target === 'packed'
        ? { status: FulfillmentStatus.packed }
        : { status: FulfillmentStatus.delivered, deliveredAt: new Date() };
      const updated = await tx.fulfillment.update({ where: { id: assignment.fulfillmentId }, data });
      await this.audit.record(tx, {
        actorId: assignment.assignedBy,
        actionKind,
        targetType: 'curation_assignment',
        targetId: assignmentId,
        reason: null,
        payloadDiffJson: { fulfillmentStatus: target },
      });
      return updated;
    });
  }
}
