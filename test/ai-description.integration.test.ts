import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { ProfileDescriptionService } from '../src/profile/profile-description.service';
import { ProfileService } from '../src/profile/profile.service';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { assertTestDatabase } from './helpers/test-database';

const url = process.env.TEST_DATABASE_URL;
const run = describe.runIf(Boolean(url));
assertTestDatabase(url);

const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const fakeDeepseek = { chatText: vi.fn().mockResolvedValue('A Ana le gustan los personajes complejos y las historias cortas.') };
const profileService = prisma ? new ProfileService(prisma as never) : null;
const descriptionService = prisma ? new ProfileDescriptionService(prisma as never, fakeDeepseek as never) : null;

async function cleanDatabase() {
  if (!prisma) return;
  await prisma.curatorActionAudit.deleteMany();
  await prisma.recommendationCandidate.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.profileVersionEvidence.deleteMany();
  await prisma.readerProfileVersion.deleteMany();
  await prisma.readerEvidence.deleteMany();
  await prisma.readerPositiveTriggerEvidence.deleteMany();
  await prisma.readerPositiveTrigger.deleteMany();
  await prisma.readerConditionalRule.deleteMany();
  await prisma.readerTagEvidence.deleteMany();
  await prisma.readerTagPreference.deleteMany();
  await prisma.readerOperationalConstraints.deleteMany();
  await prisma.readerProfileDimension.deleteMany();
  await prisma.readerProfile.deleteMany();
  await prisma.questionAnswer.deleteMany();
  await prisma.questionnaireSession.deleteMany();
  await prisma.readingFeedbackAspect.deleteMany();
  await prisma.readingFeedback.deleteMany();
  await prisma.feedbackInvitation.deleteMany();
  await prisma.curationAssignment.deleteMany();
  await prisma.user.deleteMany();
}

async function createCompletedReader(name: string) {
  const userId = randomUUID();
  await prisma!.user.create({ data: { id: userId, email: `${name.toLowerCase().replace(/\s+/g, '.')}@test.dev`, displayName: name } });
  const profile = await profileService!.ensureProfile(userId);
  await prisma!.questionnaireSession.create({ data: { userId, questionnaireVersion: 'onboarding/1.1', status: 'completed', completedAt: new Date() } });
  await prisma!.readerTagPreference.create({ data: { profileId: profile.id, tagKey: 'science_fiction', tagType: 'genre', affinity: 0.8 } });
  return { userId, profile };
}

run('ai-description (integration)', () => {
  beforeEach(async () => {
    await cleanDatabase();
    fakeDeepseek.chatText.mockClear();
    fakeDeepseek.chatText.mockResolvedValue('A Ana le gustan los personajes complejos y las historias cortas.');
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma?.$disconnect();
  });

  it('generates a description and marks the profile ready', async () => {
    const { userId } = await createCompletedReader('Ana García');
    const result = await descriptionService!.generate(userId);
    expect(result.status).toBe('ready');
    const updated = await prisma!.readerProfile.findUnique({ where: { userId } });
    expect(updated?.aiDescriptionStatus).toBe('ready');
    expect(updated?.aiDescription).toBe('A Ana le gustan los personajes complejos y las historias cortas.');
    expect(updated?.aiDescriptionGeneratedAt).not.toBeNull();
  });

  it('truncates long responses to 400 characters', async () => {
    fakeDeepseek.chatText.mockResolvedValue(`palabra ${'x'.repeat(500)} final`);
    const { userId } = await createCompletedReader('Ana García');
    await descriptionService!.generate(userId);
    const updated = await prisma!.readerProfile.findUnique({ where: { userId } });
    expect(updated?.aiDescription!.length).toBeLessThanOrEqual(400);
  });

  it('keeps status pending when the provider fails', async () => {
    fakeDeepseek.chatText.mockRejectedValueOnce(new Error('provider down'));
    const { userId } = await createCompletedReader('Ana García');
    const result = await descriptionService!.generate(userId);
    expect(result.status).toBe('pending');
    const updated = await prisma!.readerProfile.findUnique({ where: { userId } });
    expect(updated?.aiDescriptionStatus).toBe('pending');
    expect(updated?.aiDescription).toBeNull();
  });

  it('ensureGeneration backfills profiles lazily and is idempotent while generating', async () => {
    const { userId } = await createCompletedReader('Ana García');
    await prisma!.readerProfile.update({ where: { userId }, data: { aiDescription: null, aiDescriptionStatus: 'none' } });

    void descriptionService!.ensureGeneration(userId);
    await vi.waitFor(async () => {
      const updated = await prisma!.readerProfile.findUnique({ where: { userId } });
      expect(updated?.aiDescriptionStatus).toBe('ready');
    });

    const calls = fakeDeepseek.chatText.mock.calls.length;
    await prisma!.readerProfile.update({ where: { userId }, data: { aiDescription: null, aiDescriptionStatus: 'generating' } });
    await descriptionService!.ensureGeneration(userId);
    expect(fakeDeepseek.chatText.mock.calls.length).toBe(calls);
  });

  it('ensureGeneration resolves a stale pending status when no feedbacks are active', async () => {
    const { userId } = await createCompletedReader('Ana García');
    await prisma!.readerProfile.update({ where: { userId }, data: { aiDescription: null, aiDescriptionStatus: 'pending' } });

    void descriptionService!.ensureGeneration(userId);
    await vi.waitFor(async () => {
      const updated = await prisma!.readerProfile.findUnique({ where: { userId } });
      expect(updated?.aiDescriptionStatus).toBe('ready');
    });
  });

  it('ensureGeneration leaves pending untouched while feedbacks are still active', async () => {
    const { userId } = await createCompletedReader('Ana García');
    await prisma!.readerProfile.update({ where: { userId }, data: { aiDescription: null, aiDescriptionStatus: 'pending' } });
    await prisma!.readingFeedback.create({ data: { userId, feedbackVersion: '1.0', started: true, readingStatus: 'in_progress', completionPercentage: 50 } });

    await descriptionService!.ensureGeneration(userId);
    const updated = await prisma!.readerProfile.findUnique({ where: { userId } });
    expect(updated?.aiDescriptionStatus).toBe('pending');
  });

  it('detects active feedback cycles (pending learning feedbacks)', async () => {
    const { userId } = await createCompletedReader('Ana García');
    expect(await descriptionService!.hasActiveFeedbackCycles(userId)).toBe(false);

    await prisma!.readingFeedback.create({ data: { userId, feedbackVersion: '1.0', started: true, readingStatus: 'in_progress', completionPercentage: 50 } });
    expect(await descriptionService!.hasActiveFeedbackCycles(userId)).toBe(true);

    await prisma!.readingFeedback.deleteMany({ where: { userId } });
    expect(await descriptionService!.hasActiveFeedbackCycles(userId)).toBe(false);
  });

  it('reset defers regeneration (status pending) when there are active feedbacks', async () => {
    const { userId } = await createCompletedReader('Ana García');
    await descriptionService!.generate(userId);
    await prisma!.readingFeedback.create({ data: { userId, feedbackVersion: '1.0', started: true, readingStatus: 'in_progress', completionPercentage: 50 } });

    const questionnaire = new QuestionnaireService(prisma as never, profileService!, new EvidenceFactory(), { notifyNewReader: vi.fn() } as never, descriptionService!, { sendEvent: vi.fn().mockResolvedValue(undefined) } as never);
    await questionnaire.reset(userId);

    const updated = await prisma!.readerProfile.findUnique({ where: { userId } });
    expect(updated?.aiDescriptionStatus).toBe('pending');
    expect(updated?.aiDescription).toBeNull();
  });
});
