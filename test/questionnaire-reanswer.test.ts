import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { PrismaService } from '../src/prisma/prisma.service';

const QUESTION = {
  id: 'q3',
  questionKey: 'Q03_READING_PACE',
  version: 1,
  questionnaireVersion: 'onboarding/1.1',
  responseType: 'scale',
  isRequired: true,
  textEsMx: '¿A qué ritmo lees?',
  validationJson: null,
  optionMappings: [
    { optionKey: 'q03', evidenceMappingsJson: [{ dimensionKey: 'reading_pace', observedValue: 0.5, reasonCode: 'q03_pace', baseWeight: 0.5 }] },
  ],
};

const SESSION = {
  id: 's1',
  userId: 'u1',
  status: 'started',
  questionnaireVersion: 'onboarding/1.1',
  answers: [],
};

function txMock() {
  const tx = {
    questionAnswer: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'new-answer' }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    readerEvidence: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    readerPositiveTriggerEvidence: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerConditionalRule: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerPositiveTrigger: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  return tx;
}

function serviceWith(overrides: Record<string, unknown>) {
  const prisma = {
    questionnaireSession: { findUnique: vi.fn().mockResolvedValue(SESSION) },
    questionAnswer: { findUnique: vi.fn().mockResolvedValue(null) },
    questionDefinition: { findUnique: vi.fn().mockResolvedValue(QUESTION), findMany: vi.fn().mockResolvedValue([QUESTION]) },
    $transaction: overrides.transaction ?? vi.fn(),
  } as unknown as PrismaService;
  const profiles = {
    ensureProfile: vi.fn().mockResolvedValue({ id: 'p1' }),
    recompute: vi.fn().mockResolvedValue({}),
  } as unknown as ProfileService;
  const evidenceFactory = { createMany: vi.fn().mockResolvedValue(undefined) } as unknown as EvidenceFactory;
  const service = new QuestionnaireService(prisma, profiles, evidenceFactory, {} as never, {} as never);
  return { service, prisma, profiles, evidenceFactory };
}

describe('questionnaire re-answer', () => {
  it('replaces an existing answer and deactivates its evidence', async () => {
    const tx = txMock();
    tx.questionAnswer.findMany.mockResolvedValue([
      { id: 'old-answer', questionKey: 'Q03_READING_PACE' },
    ]);
    const { service, profiles } = serviceWith({ transaction: vi.fn().mockImplementation((run: (t: unknown) => Promise<unknown>) => run(tx)) });
    await service.submitAnswer('s1', 'Q03_READING_PACE', { response: 4, idempotencyKey: 'idem-2' }, 'u1');

    expect(tx.questionAnswer.deleteMany).toHaveBeenCalledWith({ where: { sessionId: 's1', questionKey: 'Q03_READING_PACE' } });
    expect(tx.readerEvidence.updateMany).toHaveBeenCalledWith(
      { where: { sourceId: { in: ['old-answer'] } }, data: { status: 'rejected', deactivatedAt: expect.any(Date) } },
    );
    expect(tx.questionAnswer.create).toHaveBeenCalledOnce();
    expect(profiles.recompute).not.toHaveBeenCalled();
  });

  it('keeps working when no previous answer exists', async () => {
    const tx = txMock();
    const { service } = serviceWith({ transaction: vi.fn().mockImplementation((run: (t: unknown) => Promise<unknown>) => run(tx)) });
    await service.submitAnswer('s1', 'Q03_READING_PACE', { response: 2, idempotencyKey: 'idem-1' }, 'u1');
    expect(tx.questionAnswer.deleteMany).not.toHaveBeenCalled();
    expect(tx.questionAnswer.create).toHaveBeenCalledOnce();
  });

  it('returns the question with its saved response', async () => {
    const { service } = serviceWith({ transaction: vi.fn() });
    const raw = { value: 4 };
    (service as unknown as { prisma: PrismaService }).prisma.questionnaireSession.findUnique = vi.fn().mockResolvedValue({
      ...SESSION,
      answers: [{ questionKey: 'Q03_READING_PACE', rawResponse: raw }],
    });
    const result = await service.getQuestionWithResponse('s1', 'Q03_READING_PACE', 'u1');
    expect(result.questionKey).toBe('Q03_READING_PACE');
    expect(result.response).toEqual(raw);
  });

  it('returns a null response when the question was not answered', async () => {
    const { service } = serviceWith({ transaction: vi.fn() });
    (service as unknown as { prisma: PrismaService }).prisma.questionnaireSession.findUnique = vi.fn().mockResolvedValue({
      ...SESSION,
      answers: [],
    });
    const result = await service.getQuestionWithResponse('s1', 'Q03_READING_PACE', 'u1');
    expect(result.response).toBeNull();
  });

  it('rejects sessions that do not belong to the user', async () => {
    const { service } = serviceWith({ transaction: vi.fn() });
    (service as unknown as { prisma: PrismaService }).prisma.questionnaireSession.findUnique = vi.fn().mockResolvedValue({
      ...SESSION,
      userId: 'other-user',
    });
    await expect(service.getQuestionWithResponse('s1', 'Q03_READING_PACE', 'u1')).rejects.toThrow(ForbiddenException);
  });
});
