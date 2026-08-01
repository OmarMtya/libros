import { afterEach, describe, expect, it, vi } from 'vitest';
import { backfillQ03Priority } from '../prisma/backfill-q03-priority';
import { ProfileService } from '../src/profile/profile.service';

const prismaMock = () => ({
  questionAnswer: {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 'answer-1',
        questionKey: 'Q03_PRIORITY_RANKING',
        normalizedResponse: { ranking: ['characters', 'atmosphere', 'plot'] },
        rawResponse: { ranking: ['characters', 'atmosphere', 'plot'] },
        session: { userId: 'u1' },
      },
      {
        id: 'answer-2',
        questionKey: 'Q03_PRIORITY_RANKING',
        normalizedResponse: { ranking: ['plot', 'style', 'emotion'] },
        rawResponse: { ranking: ['plot', 'style', 'emotion'] },
        session: { userId: 'u2' },
      },
    ]),
    update: vi.fn().mockImplementation(async (args: { where: { id: string }; data: unknown }) => ({ id: args.where.id, ...(args.data as object) })),
  },
});

describe('Q03 priority backfill', () => {
  afterEach(() => vi.restoreAllMocks());

  it('migrates historical ranking answers without deleting them and triggers a profile recompute', async () => {
    const prisma = prismaMock();
    const recompute = vi.spyOn(ProfileService.prototype, 'recompute').mockResolvedValue({ profile: { id: 'p1' }, version: null, created: true } as never);
    const results = await backfillQ03Priority(prisma as never);

    expect(prisma.questionAnswer.update).toHaveBeenCalledTimes(2);
    const firstUpdate = prisma.questionAnswer.update.mock.calls[0]![0];
    expect(firstUpdate.where.id).toBe('answer-1');
    expect(firstUpdate.data.normalizedResponse).toMatchObject({
      ranking: ['characters', 'atmosphere', 'plot'],
      priorityVector: { characters: 0.5, atmosphere: 0.3333, plot: 0.1667, ideas: 0, style: 0, emotion: 0 },
      normalizationMethod: 'borda_3_2_1_div_6',
      mappingVersion: 'priority-vector/1.0',
    });
    expect(prisma.questionAnswer.findMany).toHaveBeenCalledOnce();
    expect(recompute).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
    expect(results.every((result) => result.updatedAnswer === true && result.profileVersionCreated === true)).toBe(true);
  });

  it('does not rewrite answers that are already mapped', async () => {
    const prisma = prismaMock();
    prisma.questionAnswer.findMany.mockResolvedValue([
      {
        id: 'answer-1',
        questionKey: 'Q03_PRIORITY_RANKING',
        normalizedResponse: { ranking: ['characters', 'atmosphere', 'plot'], priorityVector: { characters: 0.5, atmosphere: 0.3333, plot: 0.1667, ideas: 0, style: 0, emotion: 0 }, normalizationMethod: 'borda_3_2_1_div_6', mappingVersion: 'priority-vector/1.0' },
        rawResponse: { ranking: ['characters', 'atmosphere', 'plot'] },
        session: { userId: 'u1' },
      },
    ]);
    vi.spyOn(ProfileService.prototype, 'recompute').mockResolvedValue({ profile: { id: 'p1' }, version: null, created: false } as never);
    const results = await backfillQ03Priority(prisma as never);
    expect(prisma.questionAnswer.update).not.toHaveBeenCalled();
    expect(results[0]!.updatedAnswer).toBe(false);
  });

  it('skips answers without a usable ranking without failing', async () => {
    const prisma = prismaMock();
    prisma.questionAnswer.findMany.mockResolvedValue([
      { id: 'answer-1', questionKey: 'Q03_PRIORITY_RANKING', normalizedResponse: { value: 3 }, rawResponse: { value: 3 }, session: { userId: 'u1' } },
    ]);
    vi.spyOn(ProfileService.prototype, 'recompute').mockResolvedValue({ profile: { id: 'p1' }, version: null, created: false } as never);
    const results = await backfillQ03Priority(prisma as never);
    expect(prisma.questionAnswer.update).not.toHaveBeenCalled();
    expect(results[0]!.skipped).toBe('no ranking found');
  });
});
