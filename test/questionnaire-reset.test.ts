import { describe, expect, it, vi } from 'vitest';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { PrismaService } from '../src/prisma/prisma.service';

type TxRecord = {
  questionnaireSession: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
};

function mockService() {
  const tx: TxRecord = {
    questionnaireSession: {
      findFirst: vi.fn().mockResolvedValue({ id: 'session-1', metadataJson: null }),
      update: vi.fn().mockResolvedValue({ id: 'session-1' }),
    },
  };
  const prisma = {
    $transaction: vi.fn().mockImplementation(async (callback: unknown) => (callback as (tx: TxRecord) => Promise<unknown>)(tx)),
    readerProfile: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    questionnaireSession: {
      findUnique: vi.fn().mockResolvedValue({ id: 'session-1', userId: 'user-1', questionnaireVersion: 'onboarding/1.1', answers: [] }),
      update: vi.fn().mockResolvedValue({ id: 'session-1' }),
    },
    questionDefinition: { findMany: vi.fn().mockResolvedValue([]) },
    readerProfileVersion: { findFirst: vi.fn().mockResolvedValue({ id: 'version-1' }) },
  } as unknown as PrismaService;
  const profiles = {
    ensureProfile: vi.fn().mockResolvedValue({ id: 'profile-1', userId: 'user-1' }),
    recompute: vi.fn().mockResolvedValue({ profile: { id: 'profile-1' }, version: { version: 2 }, created: true }),
  } as unknown as ProfileService;
  const evidenceFactory = {} as unknown as EvidenceFactory;
  const descriptions = {
    hasActiveFeedbackCycles: vi.fn().mockResolvedValue(false),
    triggerGeneration: vi.fn().mockResolvedValue(undefined),
  };
  const service = new QuestionnaireService(prisma, profiles, evidenceFactory, {} as never, descriptions as never, {} as never);
  return { service, tx, profiles, descriptions, prisma };
}

describe('questionnaire reset', () => {
  it('reopens the completed session without deleting its answers, then recomputes', async () => {
    const { service, tx, profiles } = mockService();
    await service.reset('user-1');

    expect(tx.questionnaireSession.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', questionnaireVersion: 'onboarding/1.1', status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });
    expect(tx.questionnaireSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { status: 'started', completedAt: null, metadataJson: { mode: 'revision' } },
    });
    expect(profiles.recompute).toHaveBeenCalledWith('user-1', 'questionnaire_reset');
  });

  it('does not deactivate questionnaire evidence while the user edits responses', async () => {
    const { service, tx } = mockService();

    await service.reset('user-1');

    expect(tx.questionnaireSession.update).toHaveBeenCalledOnce();
  });

  it('invalidates the AI description without generating before the new questionnaire is complete', async () => {
    const { service, descriptions } = mockService();

    await service.reset('user-1');

    expect(descriptions.hasActiveFeedbackCycles).toHaveBeenCalledWith('user-1');
    expect(descriptions.triggerGeneration).not.toHaveBeenCalled();
  });

  it('defers regeneration (status pending) when there are active feedbacks', async () => {
    const { service, descriptions } = mockService();
    (descriptions.hasActiveFeedbackCycles as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await service.reset('user-1');

    expect(descriptions.triggerGeneration).not.toHaveBeenCalled();
  });

  it('clears the description and starts generation only after completing the new questionnaire', async () => {
    const { service, descriptions, prisma } = mockService();

    await service.completeSession('session-1', 'user-1');

    expect(prisma.readerProfile.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { aiDescription: null, aiDescriptionStatus: 'invalidated' },
    });
    expect(descriptions.triggerGeneration).toHaveBeenCalledWith('user-1');
  });

  it('starts description generation after completion even with active feedbacks', async () => {
    const { service, descriptions } = mockService();
    (descriptions.hasActiveFeedbackCycles as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await service.completeSession('session-1', 'user-1');

    expect(descriptions.triggerGeneration).toHaveBeenCalledWith('user-1');
  });
});
