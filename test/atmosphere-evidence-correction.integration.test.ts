import { randomUUID } from 'node:crypto';
import { EvidenceStatus, PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { deactivateAtmosphereEvidence } from '../prisma/backfill-deactivate-atmosphere-evidence';
import { ProfileService } from '../src/profile/profile.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { assertTestDatabase } from './helpers/test-database';

const url = process.env.TEST_DATABASE_URL;
const run = describe.runIf(Boolean(url));
assertTestDatabase(url);

const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const profileService = prisma ? new ProfileService(prisma as never) : null;

async function cleanDatabase() {
  if (!prisma) return;
  await prisma.profileVersionEvidence.deleteMany();
  await prisma.readerProfileVersion.deleteMany();
  await prisma.readerEvidence.deleteMany();
  await prisma.readerTagEvidence.deleteMany();
  await prisma.readerTagPreference.deleteMany();
  await prisma.readerOperationalConstraints.deleteMany();
  await prisma.readerProfileDimension.deleteMany();
  await prisma.readerProfile.deleteMany();
  await prisma.questionAnswer.deleteMany();
  await prisma.questionnaireSession.deleteMany();
  await prisma.user.deleteMany();
}

run('corrección de evidencia incorrecta de atmosphere', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma?.$disconnect();
  });

  async function seedProfileWithEvidence() {
    const userId = randomUUID();
    await prisma!.user.create({ data: { id: userId } });
    const profile = await profileService!.ensureProfile(userId);

    const questionnaireEvidence = {
      userId,
      profileId: profile.id,
      sourceType: 'questionnaire_answer' as const,
      sourceId: randomUUID(),
      dimensionKey: 'descriptive_density_preference',
      observedValue: 0.85,
      direction: 1,
      baseWeight: 0.6,
      exposureFactor: 1,
      specificityFactor: 1,
      attributionFactor: 1,
      finalWeight: 0.6,
      reasonCode: 'q06_atmosphere_description_v1_1',
      rawPayload: {},
      evidenceFingerprint: randomUUID(),
      status: EvidenceStatus.active,
    };
    const atmosphereEvidence = {
      userId,
      profileId: profile.id,
      sourceType: 'reading_feedback' as const,
      sourceId: randomUUID(),
      bookId: randomUUID(),
      dimensionKey: 'descriptive_density_preference',
      observedValue: 0.44,
      direction: 1,
      baseWeight: 1.4,
      exposureFactor: 1,
      specificityFactor: 0.8,
      attributionFactor: 1,
      finalWeight: 1.4,
      reasonCode: 'f05_atmosphere_learn',
      rawPayload: { feedback_id: 'fb-atm' },
      evidenceFingerprint: randomUUID(),
      status: EvidenceStatus.active,
    };
    const tensionEvidence = {
      userId,
      profileId: profile.id,
      sourceType: 'reading_feedback' as const,
      sourceId: randomUUID(),
      bookId: randomUUID(),
      dimensionKey: 'tension_preference',
      observedValue: 0.94,
      direction: 1,
      baseWeight: 1.4,
      exposureFactor: 1,
      specificityFactor: 0.8,
      attributionFactor: 1,
      finalWeight: 1.4,
      reasonCode: 'f05_tension_learn',
      rawPayload: { feedback_id: 'fb-tension' },
      evidenceFingerprint: randomUUID(),
      status: EvidenceStatus.active,
    };

    await prisma!.readerEvidence.createMany({ data: [questionnaireEvidence, atmosphereEvidence, tensionEvidence] });
    const created = await prisma!.readerEvidence.findMany({ where: { profileId: profile.id } });
    return { userId, profile, atmosphereEvidence: created.find((row) => row.reasonCode === 'f05_atmosphere_learn')!, tensionEvidence: created.find((row) => row.reasonCode === 'f05_tension_learn')!, questionnaireEvidence: created.find((row) => row.sourceType === 'questionnaire_answer')! };
  }

  it('desactiva únicamente f05_atmosphere_learn, conserva lo demás y recomputa desde el agregador', async () => {
    const { userId, profile, atmosphereEvidence, tensionEvidence, questionnaireEvidence } = await seedProfileWithEvidence();
    const versionsBefore = await prisma!.readerProfileVersion.count({ where: { profileId: profile.id } });

    const result = await deactivateAtmosphereEvidence(prisma!);

    expect(result.deactivated).toEqual([expect.objectContaining({ evidenceId: atmosphereEvidence.id, dimensionKey: 'descriptive_density_preference' })]);
    expect(result.recomputed).toEqual([expect.objectContaining({ profileId: profile.id, userId, versionCreated: true })]);

    const atmosphereAfter = await prisma!.readerEvidence.findUniqueOrThrow({ where: { id: atmosphereEvidence.id } });
    const tensionAfter = await prisma!.readerEvidence.findUniqueOrThrow({ where: { id: tensionEvidence.id } });
    const questionnaireAfter = await prisma!.readerEvidence.findUniqueOrThrow({ where: { id: questionnaireEvidence.id } });
    expect(atmosphereAfter.status).toBe(EvidenceStatus.deactivated);
    expect(atmosphereAfter.deactivatedAt).not.toBeNull();
    expect(tensionAfter.status).toBe(EvidenceStatus.active);
    expect(questionnaireAfter.status).toBe(EvidenceStatus.active);

    const dimension = await prisma!.readerProfileDimension.findUniqueOrThrow({
      where: { profileId_dimensionKey: { profileId: profile.id, dimensionKey: 'descriptive_density_preference' } },
    });
    expect(Number(dimension.value)).toBeCloseTo(0.85, 4);
    expect(dimension.evidenceCount).toBe(1);

    const versionsAfter = await prisma!.readerProfileVersion.count({ where: { profileId: profile.id } });
    expect(versionsAfter).toBe(versionsBefore + 1);
    const history = await prisma!.readerProfileVersion.findMany({ where: { profileId: profile.id }, orderBy: { version: 'asc' } });
    expect(history.map((version) => version.changeReason)).toContain('atmosphere_evidence_correction');
  });

  it('es idempotente: una segunda corrida no desactiva nada ni crea otra versión', async () => {
    const { profile } = await seedProfileWithEvidence();
    await deactivateAtmosphereEvidence(prisma!);
    const versionsAfterFirst = await prisma!.readerProfileVersion.count({ where: { profileId: profile.id } });

    const second = await deactivateAtmosphereEvidence(prisma!);

    expect(second.deactivated).toEqual([]);
    expect(second.recomputed).toEqual([]);
    const versionsAfterSecond = await prisma!.readerProfileVersion.count({ where: { profileId: profile.id } });
    expect(versionsAfterSecond).toBe(versionsAfterFirst);
    const active = await prisma!.readerEvidence.count({ where: { profileId: profile.id, reasonCode: 'f05_atmosphere_learn', status: EvidenceStatus.active } });
    expect(active).toBe(0);
  });
});
