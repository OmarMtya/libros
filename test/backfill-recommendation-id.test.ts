import { afterEach, describe, expect, it, vi } from 'vitest';
import { backfillRecommendationId } from '../prisma/backfill-recommendation-id';

const prismaMock = () => {
  const update = vi.fn().mockImplementation(async (args: { where: { id: string }; data: unknown }) => ({ id: args.where.id, ...(args.data as object) }));
  const findMany = vi.fn().mockResolvedValue([]);
  return {
    readingFeedback: { findMany, update },
    findMany,
  };
};

describe('backfillRecommendationId', () => {
  afterEach(() => vi.restoreAllMocks());

  it('llena recommendationId desde el candidato ligado a la asignación', async () => {
    const prisma = prismaMock();
    prisma.readingFeedback.findMany.mockResolvedValue([
      {
        id: 'fb-1',
        curationAssignmentId: 'ca-1',
        recommendationId: null,
        assignment: { recommendationCandidate: { recommendationId: 'rec-historical' } },
      },
      {
        id: 'fb-2',
        curationAssignmentId: 'ca-2',
        recommendationId: null,
        assignment: { recommendationCandidate: { recommendationId: 'rec-override' } },
      },
    ]);

    const results = await backfillRecommendationId(prisma as never);

    expect(results).toEqual([
      { feedbackId: 'fb-1', updated: true, recommendationId: 'rec-historical' },
      { feedbackId: 'fb-2', updated: true, recommendationId: 'rec-override' },
    ]);
    expect(prisma.readingFeedback.update).toHaveBeenCalledTimes(2);
    expect(prisma.readingFeedback.update).toHaveBeenCalledWith({ where: { id: 'fb-1' }, data: { recommendationId: 'rec-historical' } });
    expect(prisma.readingFeedback.update).toHaveBeenCalledWith({ where: { id: 'fb-2' }, data: { recommendationId: 'rec-override' } });
  });

  it('no modifica filas sin candidato ligado (legacy) y las reporta como skipped', async () => {
    const prisma = prismaMock();
    prisma.readingFeedback.findMany.mockResolvedValue([
      { id: 'fb-legacy', curationAssignmentId: 'ca-1', recommendationId: null, assignment: { recommendationCandidate: null } },
      { id: 'fb-orphan', curationAssignmentId: 'ca-2', recommendationId: null, assignment: null },
    ]);

    const results = await backfillRecommendationId(prisma as never);

    expect(prisma.readingFeedback.update).not.toHaveBeenCalled();
    expect(results.every((result) => result.updated === false && result.skipped === 'no linked candidate')).toBe(true);
  });

  it('no toca filas ya corregidas (solo consulta recommendationId null)', async () => {
    const prisma = prismaMock();
    const results = await backfillRecommendationId(prisma as never);

    expect(prisma.readingFeedback.findMany).toHaveBeenCalledOnce();
    const where = prisma.readingFeedback.findMany.mock.calls[0]![0].where as { recommendationId: null; curationAssignmentId: { not: null } };
    expect(where.recommendationId).toBeNull();
    expect(where.curationAssignmentId).toEqual({ not: null });
    expect(prisma.readingFeedback.update).not.toHaveBeenCalled();
    expect(results).toEqual([]);
  });
});
