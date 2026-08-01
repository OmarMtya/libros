import { Injectable } from '@nestjs/common';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

export type CreatedInvitation = {
  invitation: { id: string; curationAssignmentId: string };
  plainToken: string;
  url: string;
};

@Injectable()
export class FeedbackInvitationService {
  private readonly secret: Buffer;

  constructor() {
    this.secret = Buffer.from(process.env.INVITATION_SIGNING_SECRET ?? randomBytes(32).toString('hex'), 'utf8');
  }

  generateToken(invitationId: string): string {
    return createHmac('sha256', this.secret).update(invitationId, 'utf8').digest('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  urlFor(token: string): string {
    const appUrl = process.env.APP_URL ?? 'http://localhost:4200';
    return `${appUrl.replace(/\/$/, '')}/feedback/${token}`;
  }

  async createPending(tx: Prisma.TransactionClient, curationAssignmentId: string, now = new Date()): Promise<CreatedInvitation> {
    const id = randomUUID();
    const plainToken = this.generateToken(id);
    const invitation = await tx.feedbackInvitation.create({
      data: {
        id,
        curationAssignmentId,
        tokenHash: this.hashToken(plainToken),
        status: 'pending',
        expiresAt: null,
        createdAt: now,
      },
    });
    return { invitation: { id: invitation.id, curationAssignmentId }, plainToken, url: this.urlFor(plainToken) };
  }
}
