import { describe, expect, it, vi } from 'vitest';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { PrismaService } from '../src/prisma/prisma.service';

type TxRecord = {
  questionnaireSession: { deleteMany: ReturnType<typeof vi.fn> };
  readerTagPreference: { deleteMany: ReturnType<typeof vi.fn> };
  readerOperationalConstraints: { deleteMany: ReturnType<typeof vi.fn> };
  readerConditionalRule: { deleteMany: ReturnType<typeof vi.fn> };
  readerPositiveTrigger: { deleteMany: ReturnType<typeof vi.fn> };
  readerEvidence: {
    findMany: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
};

function mockService() {
  const tx: TxRecord = {
    questionnaireSession: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerTagPreference: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerOperationalConstraints: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerConditionalRule: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerPositiveTrigger: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerEvidence: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const prisma = {
    $transaction: vi.fn().mockImplementation(async (callback: unknown) => (callback as (tx: TxRecord) => Promise<unknown>)(tx)),
  } as unknown as PrismaService;
  const profiles = {
    ensureProfile: vi.fn().mockResolvedValue({ id: 'profile-1', userId: 'user-1' }),
    recompute: vi.fn().mockResolvedValue({ profile: { id: 'profile-1' }, version: { version: 2 }, created: true }),
  } as unknown as ProfileService;
  const evidenceFactory = {} as unknown as EvidenceFactory;
  const service = new QuestionnaireService(prisma, profiles, evidenceFactory, {} as never);
  return { service, tx, profiles };
}

describe('questionnaire reset', () => {
  it('deletes sessions and questionnaire-derived profile data, then recomputes', async () => {
    const { service, tx, profiles } = mockService();
    await service.reset('user-1');

    expect(tx.questionnaireSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(tx.readerTagPreference.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'profile-1' } });
    expect(tx.readerOperationalConstraints.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'profile-1' } });
    expect(tx.readerConditionalRule.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'profile-1' } });
    expect(tx.readerPositiveTrigger.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'profile-1' } });
    expect(profiles.recompute).toHaveBeenCalledWith('user-1', 'questionnaire_reset');
  });

  it('clears supersession references and deactivates questionnaire evidence', async () => {
    const { service, tx } = mockService();
    tx.readerEvidence.findMany.mockResolvedValue([{ id: 'ev-1' }, { id: 'ev-2' }]);

    await service.reset('user-1');

    expect(tx.readerEvidence.updateMany).toHaveBeenNthCalledWith(1, {
      where: { supersededById: { in: ['ev-1', 'ev-2'] } },
      data: { supersededById: null },
    });
    const [, second] = tx.readerEvidence.updateMany.mock.calls;
    expect(second?.[0]?.where.id.in).toEqual(['ev-1', 'ev-2']);
    expect(second?.[0]?.data.status).toBe('rejected');
  });

  it('only touches questionnaire evidence, leaving feedback evidence active', async () => {
    const { service, tx } = mockService();

    await service.reset('user-1');

    expect(tx.readerEvidence.findMany).toHaveBeenCalledWith({
      where: { profileId: 'profile-1', sourceType: 'questionnaire_answer' },
      select: { id: true },
    });
    expect(tx.readerEvidence.updateMany).not.toHaveBeenCalled();
  });
});
