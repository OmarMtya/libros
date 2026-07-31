import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { migrateReaderProfile1_1 } from '../prisma/migrate-reader-profile-1-1';

const sessionId = '0615ceb5-2cb9-4d03-bc84-53320cdf3d37';
const prisma = new PrismaClient();

describe.skipIf(process.env.RUN_PROFILE_MIGRATION_INTEGRATION !== 'true')('reader profile 1.1 data migration', () => {
  afterAll(() => prisma.$disconnect());

  it('is idempotent, preserves historical evidence, and makes the diagnostic profile ready', async () => {
    const first = await migrateReaderProfile1_1(prisma, sessionId);
    const second = await migrateReaderProfile1_1(prisma, sessionId);
    const historical = await prisma.readerEvidence.findMany({ where: { profileId: first.profile.id, reasonCode: { in: ['q06_atmosphere_description', 'q10_emotion_curiosity', 'q10_emotion_reflection'] } } });
    const active = await prisma.readerEvidence.findMany({ where: { profileId: first.profile.id, status: 'active', reasonCode: { endsWith: '_v1_1' } } });
    const rule = await prisma.readerConditionalRule.findFirst({ where: { profileId: first.profile.id, ruleKey: 'slow_burn_compensators' } });
    const runtimeDimensions = await prisma.dimensionDefinition.findMany({ where: { isActive: true }, orderBy: { key: 'asc' } });

    expect(first.profile.readyToRecommend).toBe(true);
    expect(second.profileVersionCreated).toBe(false);
    expect(historical).toHaveLength(3);
    expect(historical.every((evidence) => evidence.status === 'superseded')).toBe(true);
    expect(active.length).toBeGreaterThanOrEqual(5);
    expect(rule).not.toBeNull();
    expect(runtimeDimensions).toHaveLength(43);
    expect(runtimeDimensions.every((dimension) => dimension.domainKey && dimension.dimensionKind && dimension.matchingOperator && dimension.schemaVersion && dimension.bookFeatureKey)).toBe(true);
  });
});
