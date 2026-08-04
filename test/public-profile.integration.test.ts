import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ProfileService } from '../src/profile/profile.service';
import { PublicProfileService } from '../src/profile/public-profile.service';
import { assertTestDatabase } from './helpers/test-database';

const url = process.env.TEST_DATABASE_URL;
const run = describe.runIf(Boolean(url));
assertTestDatabase(url);

const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const profileService = prisma ? new ProfileService(prisma as never) : null;
const publicService = prisma ? new PublicProfileService(prisma as never) : null;

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

async function createReader(completed: boolean) {
  const userId = randomUUID();
  await prisma!.user.create({ data: { id: userId, email: `${userId.slice(0, 8)}@test.dev`, displayName: 'Lector Público', avatarUrl: 'https://cdn.example/avatar.jpg' } });
  const profile = await profileService!.ensureProfile(userId);
  if (completed) {
    await prisma!.questionnaireSession.create({ data: { userId, questionnaireVersion: 'onboarding/1.1', status: 'completed', completedAt: new Date() } });
    await prisma!.readerTagPreference.create({ data: { profileId: profile.id, tagKey: 'science_fiction', tagType: 'genre', affinity: 0.8 } });
    await prisma!.readerTagPreference.create({ data: { profileId: profile.id, tagKey: 'literary_fiction', tagType: 'genre', affinity: -0.4 } });
    await prisma!.readerOperationalConstraints.create({
      data: { profileId: profile.id, preferredPagesMin: 150, preferredPagesMax: 350, seriesPreference: 'standalone_preferred', acceptedLanguagesJson: ['es'], acceptedFormatsJson: ['physical'] },
    });
  }
  return { userId, profile };
}

run('public-profile (integration)', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma?.$disconnect();
  });

  it('assigns a unique public slug to every profile', async () => {
    const { profile } = await createReader(true);
    expect(profile.publicSlug).toBeTruthy();
    const slug = profile.publicSlug!;
    expect(slug).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('exposes a curated public view without sensitive data', async () => {
    const { profile } = await createReader(true);
    const view = await publicService!.get(profile.publicSlug!);
    expect(view.slug).toBe(profile.publicSlug);
    expect(view.displayName).toBe('Lector Público');
    expect(view.avatarUrl).toBe('https://cdn.example/avatar.jpg');
    expect(view.aiDescriptionStatus).toBe('none');
    expect(view.categories.liked).toHaveLength(1);
    expect(view.categories.liked[0]!.key).toBe('science_fiction');
    expect(view.categories.notInterested[0]!.key).toBe('literary_fiction');
    expect(view.constraints?.preferredPagesMin).toBe(150);
    expect(view.constraints?.seriesPreference).toBe('standalone_preferred');
    expect(JSON.stringify(view)).not.toContain('@test.dev');
    expect(JSON.stringify(view)).not.toContain('reader_profiles');
    expect(JSON.stringify(view)).not.toContain('overallConfidence');
  });

  it('rejects unknown slugs', async () => {
    await expect(publicService!.get('no-such-slug')).rejects.toThrow('Perfil no encontrado');
  });

  it('rejects profiles without a completed questionnaire', async () => {
    const { profile } = await createReader(false);
    await expect(publicService!.get(profile.publicSlug!)).rejects.toThrow('Perfil no encontrado');
  });
});
