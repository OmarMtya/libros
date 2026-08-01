import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { backfillQ03Priority } from '../prisma/backfill-q03-priority';

const prisma = new PrismaClient();

describe.skipIf(process.env.RUN_PROFILE_MIGRATION_INTEGRATION !== 'true')('Q03 priority backfill (integration)', () => {
  afterAll(() => prisma.$disconnect());

  it('is idempotent, preserves the historical answer, and creates no reader_evidence', async () => {
    const first = await backfillQ03Priority(prisma);
    const second = await backfillQ03Priority(prisma);
    const answers = await prisma.questionAnswer.findMany({ where: { questionKey: 'Q03_PRIORITY_RANKING' } });
    const evidence = await prisma.readerEvidence.findMany({ where: { sourceType: 'questionnaire_answer' } });

    expect(answers.length).toBeGreaterThan(0);
    expect(second.every((result) => result.updatedAnswer === false && result.profileVersionCreated === false)).toBe(true);
    for (const answer of answers) {
      const normalized = answer.normalizedResponse as { priorityVector?: unknown; ranking?: unknown };
      expect(normalized.priorityVector).toBeDefined();
      expect(Array.isArray(normalized.ranking)).toBe(true);
      const vector = normalized.priorityVector as Record<string, number>;
      const sum = Object.values(vector).reduce((acc, value) => acc + value, 0);
      expect(Math.round(sum * 10000) / 10000).toBe(1);
    }
    expect(evidence.every((item) => item.reasonCode !== 'q03_priority_ranking')).toBe(true);
  });
});
