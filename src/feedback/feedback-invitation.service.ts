import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';

export const INVITATION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type CreatedInvitation = {
  invitation: { id: string; curationAssignmentId: string };
  plainToken: string;
  url: string;
};

@Injectable()
export class FeedbackInvitationService {
  generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  async createPending(tx: Prisma.TransactionClient, curationAssignmentId: string, now = new Date()): Promise<CreatedInvitation> {
    const plainToken = this.generateToken();
    const invitation = await tx.feedbackInvitation.create({
      data: {
        curationAssignmentId,
        tokenHash: this.hashToken(plainToken),
        status: 'pending',
        expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      },
    });
    const appUrl = process.env.APP_URL ?? 'http://localhost:4200';
    return { invitation: { id: invitation.id, curationAssignmentId }, plainToken, url: `${appUrl.replace(/\/$/, '')}/feedback/${plainToken}` };
  }
}
