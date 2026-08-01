import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditAction = {
  actorId: string;
  actorRole?: 'curator' | 'admin';
  actionKind: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  payloadDiffJson?: Record<string, unknown>;
};

@Injectable()
export class CuratorAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: Prisma.TransactionClient, action: AuditAction) {
    await tx.curatorActionAudit.create({
      data: {
        actorId: action.actorId,
        actorRole: action.actorRole ?? 'curator',
        actionKind: action.actionKind,
        targetType: action.targetType,
        targetId: action.targetId,
        reason: action.reason ?? null,
        payloadDiffJson: (action.payloadDiffJson ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
