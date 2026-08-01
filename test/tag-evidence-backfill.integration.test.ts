import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { backfillQ11TagEvidence } from '../prisma/backfill-q11-tag-evidence';
import { ProfileService } from '../src/profile/profile.service';
import { assertTestDatabase } from './helpers/test-database';

const url = process.env.TEST_DATABASE_URL;
const run = describe.runIf(Boolean(url));
assertTestDatabase(url);

const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const profileService = prisma ? new ProfileService(prisma as never) : null;

async function cleanTagData() {
  if (!prisma) return;
  await prisma.readerTagEvidence.deleteMany();
  await prisma.readerTagPreference.deleteMany();
  await prisma.readerProfileDimension.deleteMany();
  await prisma.readerProfile.deleteMany();
  await prisma.user.deleteMany();
}

run('backfill Q11 a evidencia de tags', () => {
  beforeEach(async () => {
    await cleanTagData();
  });

  afterAll(async () => {
    await cleanTagData();
    await prisma?.$disconnect();
  });

  it('convierte preferencias en evidencia questionnaire, re-deriva y es idempotente', async () => {
    const userId = randomUUID();
    await prisma!.user.create({ data: { id: userId } });
    const profile = await profileService!.ensureProfile(userId);
    await prisma!.readerTagPreference.create({
      data: { profileId: profile.id, tagKey: 'mystery', tagType: 'genre', affinity: 0.8, confidence: 0.4, evidenceCount: 1 },
    });

    const first = await backfillQ11TagEvidence(prisma!);
    expect(first).toHaveLength(1);
    expect(first[0]!.created).toBe(true);

    const evidence = await prisma!.readerTagEvidence.findMany({ where: { profileId: profile.id, status: 'active' } });
    expect(evidence).toHaveLength(1);
    expect(evidence[0]!.sourceType).toBe('questionnaire');
    expect(evidence[0]!.tagKey).toBe('mystery');
    expect(Number(evidence[0]!.adjustment)).toBeCloseTo(0.8, 4);

    const preference = await prisma!.readerTagPreference.findUniqueOrThrow({ where: { profileId_tagKey: { profileId: profile.id, tagKey: 'mystery' } } });
    expect(Number(preference.affinity)).toBeCloseTo(0.8, 4);
    expect(preference.evidenceCount).toBe(1);

    const second = await backfillQ11TagEvidence(prisma!);
    expect(second).toHaveLength(1);
    expect(second[0]!.created).toBe(false);
    expect(await prisma!.readerTagEvidence.count({ where: { profileId: profile.id, status: 'active' } })).toBe(1);
  });
});
