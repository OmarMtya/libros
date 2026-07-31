import { Injectable } from '@nestjs/common';
import { EvidenceSourceType, Prisma } from '@prisma/client';
import { evidenceFingerprint, round } from './profile-calculation';

export type EvidenceInput = {
  dimensionKey: string;
  observedValue: number;
  reasonCode: string;
  baseWeight: number;
  direction?: number;
  exposureFactor?: number;
  specificityFactor?: number;
  attributionFactor?: number;
  reasonText?: string;
  rawPayload: Record<string, unknown>;
};

@Injectable()
export class EvidenceFactory {
  async createMany(tx: Prisma.TransactionClient, input: {
    userId: string;
    profileId: string;
    sourceType: EvidenceSourceType;
    sourceId: string;
    bookId?: string | null;
    evidence: EvidenceInput[];
  }): Promise<void> {
    for (const item of input.evidence) {
      const exposureFactor = item.exposureFactor ?? 1;
      const specificityFactor = item.specificityFactor ?? 1;
      const attributionFactor = item.attributionFactor ?? 1;
      const finalWeight = round(item.baseWeight * exposureFactor * specificityFactor * attributionFactor);
      const fingerprint = evidenceFingerprint(input.sourceId, item.dimensionKey, item.reasonCode, item.observedValue, item.rawPayload);
      await tx.readerEvidence.upsert({
        where: { evidenceFingerprint: fingerprint },
        create: {
          userId: input.userId,
          profileId: input.profileId,
          bookId: input.bookId ?? null,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          dimensionKey: item.dimensionKey,
          observedValue: item.observedValue,
          direction: item.direction ?? 1,
          baseWeight: item.baseWeight,
          exposureFactor,
          specificityFactor,
          attributionFactor,
          finalWeight,
          reasonCode: item.reasonCode,
          reasonText: item.reasonText ?? null,
          rawPayload: item.rawPayload as Prisma.InputJsonValue,
          evidenceFingerprint: fingerprint,
        },
        update: {},
      });
    }
  }
}
