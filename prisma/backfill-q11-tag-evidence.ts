import { EvidenceStatus, Prisma, PrismaClient } from '@prisma/client';
import { deriveTagPreferences, tagEvidenceFingerprint } from '../src/feedback/feedback-tag-preferences';

const Q11_REASON_CODE = 'q11_initial';
const MAPPING_VERSION = 'questionnaire-tag/1.0';

export async function backfillQ11TagEvidence(prisma: PrismaClient) {
  const preferences = await prisma.readerTagPreference.findMany({ orderBy: [{ profileId: 'asc' }, { tagKey: 'asc' }] });
  const profileUserIds = new Map<string, string>();
  const results: Array<{ profileId: string; tagKey: string; created: boolean }> = [];

  for (const preference of preferences) {
    if (!profileUserIds.has(preference.profileId)) {
      const profile = await prisma.readerProfile.findUnique({ where: { id: preference.profileId }, select: { userId: true } });
      if (!profile) continue;
      profileUserIds.set(preference.profileId, profile.userId);
    }
    const userId = profileUserIds.get(preference.profileId)!;
    const sourceId = preference.profileId;
    const adjustment = Number(preference.affinity);
    const rawPayload = { backfill: true, source: 'reader_tag_preferences', previous_affinity: preference.affinity } as Prisma.InputJsonValue;
    const fingerprint = tagEvidenceFingerprint('questionnaire', sourceId, preference.tagKey, Q11_REASON_CODE, adjustment, rawPayload);

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.readerTagEvidence.findUnique({ where: { evidenceFingerprint: fingerprint } });
      await tx.readerTagEvidence.upsert({
        where: { evidenceFingerprint: fingerprint },
        create: {
          userId,
          profileId: preference.profileId,
          sourceType: 'questionnaire',
          sourceId,
          tagKey: preference.tagKey,
          adjustment,
          direction: adjustment < 0 ? -1 : 1,
          baseWeight: 1,
          finalWeight: 1,
          reasonCode: Q11_REASON_CODE,
          mappingVersion: MAPPING_VERSION,
          rawPayload,
          evidenceFingerprint: fingerprint,
          status: EvidenceStatus.active,
        },
        update: {},
      });
      await deriveTagPreferences(tx, preference.profileId);
      return existing === null;
    });
    results.push({ profileId: preference.profileId, tagKey: preference.tagKey, created });
  }
  return results;
}
