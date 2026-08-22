import Decimal from 'decimal.js';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { canonicalJson } from '../profile/profile-calculation';

export type TagEvidenceItem = {
  tagKey: string;
  adjustment: Decimal.Value;
  finalWeight: Decimal.Value;
};

export function tagEvidenceFingerprint(
  sourceType: 'questionnaire' | 'reading_feedback',
  sourceId: string,
  tagKey: string,
  reasonCode: string,
  adjustment: Decimal.Value,
  rawPayload: unknown,
): string {
  return createHash('sha256')
    .update([sourceType, sourceId, tagKey, reasonCode, new Decimal(adjustment).toFixed(4), canonicalJson(rawPayload)].join('|'), 'utf8')
    .digest('hex');
}

export function aggregateTagPreferences(evidence: TagEvidenceItem[]): Map<string, { affinity: Decimal; confidence: Decimal; evidenceCount: number }> {
  const byTag = new Map<string, { totalWeight: Decimal; weighted: Decimal; count: number }>();
  for (const item of evidence) {
    const weight = new Decimal(item.finalWeight);
    const entry = byTag.get(item.tagKey) ?? { totalWeight: new Decimal(0), weighted: new Decimal(0), count: 0 };
    entry.totalWeight = entry.totalWeight.plus(weight);
    entry.weighted = entry.weighted.plus(new Decimal(item.adjustment).mul(weight));
    entry.count += 1;
    byTag.set(item.tagKey, entry);
  }
  const result = new Map<string, { affinity: Decimal; confidence: Decimal; evidenceCount: number }>();
  for (const [tagKey, entry] of byTag) {
    const affinity = entry.totalWeight.gt(0)
      ? Decimal.max(-1, Decimal.min(1, entry.weighted.div(entry.totalWeight)))
      : new Decimal(0);
    const confidence = Decimal.min(0.95, new Decimal(1).minus(new Decimal(-1).mul(entry.totalWeight).div(3).exp()));
    result.set(tagKey, {
      affinity: affinity.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
      confidence: confidence.toDecimalPlaces(4, Decimal.ROUND_HALF_UP),
      evidenceCount: entry.count,
    });
  }
  return result;
}

export async function deriveTagPreferences(tx: Prisma.TransactionClient, profileId: string) {
  const active = await tx.readerTagEvidence.findMany({ where: { profileId, status: 'active' }, orderBy: { tagKey: 'asc' } });
  const tagKeys = [...new Set(active.map((evidence) => evidence.tagKey))];
  const tagVersions = tagKeys.length
    ? await tx.tagVersion.findMany({ where: { tagKey: { in: tagKeys } }, select: { tagKey: true, tagType: true } })
    : [];
  const typeByKey = new Map(tagVersions.map((version) => [version.tagKey, version.tagType]));
  const aggregated = aggregateTagPreferences(active);

  await tx.readerTagPreference.deleteMany({ where: { profileId } });
  if (aggregated.size > 0) {
    await tx.readerTagPreference.createMany({
      data: [...aggregated].map(([tagKey, aggregate]) => ({
        profileId,
        tagKey,
        tagType: typeByKey.get(tagKey) ?? 'theme',
        affinity: aggregate.affinity,
        confidence: aggregate.confidence,
        evidenceCount: aggregate.evidenceCount,
      })),
    });
  }
}
