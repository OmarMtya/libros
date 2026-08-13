import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { QuestionDefinition, ResponseType } from '@prisma/client';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { PrismaService } from '../src/prisma/prisma.service';

const Q03 = {
  id: 'q03',
  questionKey: 'Q03_PRIORITY_RANKING',
  version: 1,
  questionnaireVersion: 'onboarding/1.1',
  responseType: 'ranking',
  isRequired: true,
  textEsMx: 'Ordena las tres cosas que más valoras al leer.',
  validationJson: { allowed: ['plot', 'characters', 'ideas', 'atmosphere', 'style', 'emotion'], maxItems: 3 },
  optionMappings: [
    { optionKey: 'plot', labelEsMx: 'Trama', evidenceMappingsJson: [] },
    { optionKey: 'characters', labelEsMx: 'Personajes', evidenceMappingsJson: [] },
    { optionKey: 'ideas', labelEsMx: 'Ideas', evidenceMappingsJson: [] },
    { optionKey: 'atmosphere', labelEsMx: 'Atmósfera', evidenceMappingsJson: [] },
    { optionKey: 'style', labelEsMx: 'Estilo', evidenceMappingsJson: [] },
    { optionKey: 'emotion', labelEsMx: 'Emoción', evidenceMappingsJson: [] },
  ],
} as unknown as QuestionDefinition;

const SESSION = {
  id: 's1',
  userId: 'u1',
  status: 'started',
  questionnaireVersion: 'onboarding/1.1',
  answers: [],
};

function txMock(captured: { normalized?: unknown } = {}) {
  const tx = {
    questionAnswer: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(async (args: { data: { normalizedResponse: unknown } }) => {
        captured.normalized = args.data.normalizedResponse;
        return { id: 'new-answer' };
      }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    readerEvidence: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerPositiveTriggerEvidence: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerConditionalRule: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerPositiveTrigger: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  return tx;
}

function serviceWith(captured: { normalized?: unknown } = {}) {
  const prisma = {
    questionnaireSession: { findUnique: vi.fn().mockResolvedValue(SESSION) },
    questionAnswer: { findUnique: vi.fn().mockResolvedValue(null) },
    questionDefinition: { findUnique: vi.fn().mockResolvedValue(Q03), findMany: vi.fn().mockResolvedValue([Q03]) },
    $transaction: vi.fn(),
  } as unknown as PrismaService;
  const profiles = {
    ensureProfile: vi.fn().mockResolvedValue({ id: 'p1' }),
    recompute: vi.fn().mockResolvedValue({}),
  } as unknown as ProfileService;
  const evidenceFactory = { createMany: vi.fn().mockResolvedValue(undefined) } as unknown as EvidenceFactory;
  const tx = txMock(captured);
  prisma.$transaction = vi.fn().mockImplementation((run: (t: unknown) => Promise<unknown>) => run(tx));
  const service = new QuestionnaireService(prisma, profiles, evidenceFactory, {} as never, {} as never);
  return { service, prisma, profiles, evidenceFactory, tx };
}

describe('Q03 priority ranking', () => {
  it('persists the ranking order in normalized_response with a Borda priority_vector', async () => {
    const captured: { normalized?: unknown } = {};
    const { service } = serviceWith(captured);
    await service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: { ranking: ['characters', 'atmosphere', 'plot'] }, idempotencyKey: 'idem-1' }, 'u1');
    expect(captured.normalized).toEqual({
      ranking: ['characters', 'atmosphere', 'plot'],
      priorityVector: { characters: 0.5, atmosphere: 0.3333, plot: 0.1667, ideas: 0, style: 0, emotion: 0 },
      normalizationMethod: 'borda_3_2_1_div_6',
      mappingVersion: 'priority-vector/1.0',
    });
  });

  it('accepts a bare array response for backwards compatibility', async () => {
    const captured: { normalized?: unknown } = {};
    const { service } = serviceWith(captured);
    await service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: ['plot', 'emotion', 'style'], idempotencyKey: 'idem-1' }, 'u1');
    expect((captured.normalized as { ranking: string[] }).ranking).toEqual(['plot', 'emotion', 'style']);
  });

  it('does not create reader_evidence for Q03', async () => {
    const { service, evidenceFactory } = serviceWith();
    await service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: { ranking: ['characters', 'atmosphere', 'plot'] } }, 'u1');
    expect(evidenceFactory.createMany).not.toHaveBeenCalled();
  });

  it('does not trigger a per-answer profile recompute', async () => {
    const { service, profiles } = serviceWith();
    await service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: { ranking: ['characters', 'atmosphere', 'plot'] }, idempotencyKey: 'idem-1' }, 'u1');
    expect(profiles.recompute).not.toHaveBeenCalled();
  });

  it('changes priority_vector when the same options change order', async () => {
    const first: { normalized?: unknown } = {};
    const second: { normalized?: unknown } = {};
    const a = serviceWith(first);
    const b = serviceWith(second);
    await a.service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: { ranking: ['characters', 'atmosphere', 'plot'] } }, 'u1');
    await b.service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: { ranking: ['plot', 'atmosphere', 'characters'] } }, 'u1');
    const firstVector = (first.normalized as { priorityVector: Record<string, number> }).priorityVector;
    const secondVector = (second.normalized as { priorityVector: Record<string, number> }).priorityVector;
    expect(firstVector.characters).toBe(0.5);
    expect(secondVector.characters).toBe(0.1667);
    expect(firstVector).not.toEqual(secondVector);
  });

  it('rejects a ranking with fewer than three options', async () => {
    const { service } = serviceWith();
    await expect(service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: { ranking: ['characters', 'atmosphere'] } }, 'u1')).rejects.toThrow(BadRequestException);
  });

  it('rejects a ranking with more than three options', async () => {
    const { service } = serviceWith();
    await expect(service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: { ranking: ['characters', 'atmosphere', 'plot', 'style'] } }, 'u1')).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate options', async () => {
    const { service } = serviceWith();
    await expect(service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: { ranking: ['characters', 'characters', 'plot'] } }, 'u1')).rejects.toThrow(BadRequestException);
  });

  it('rejects an unknown option key', async () => {
    const { service } = serviceWith();
    await expect(service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: { ranking: ['characters', 'atmosphere', 'bogus'] } }, 'u1')).rejects.toThrow(BadRequestException);
  });

  it('returns the saved response preserving the ranking order', async () => {
    const { service, prisma } = serviceWith();
    (prisma as unknown as { questionnaireSession: { findUnique: unknown } }).questionnaireSession.findUnique = vi.fn().mockResolvedValue({
      ...SESSION,
      answers: [{ questionKey: 'Q03_PRIORITY_RANKING', rawResponse: { ranking: ['atmosphere', 'plot', 'characters'] } }],
    });
    const result = await service.getQuestionWithResponse('s1', 'Q03_PRIORITY_RANKING', 'u1');
    expect(result.questionKey).toBe('Q03_PRIORITY_RANKING');
    expect(result.response).toEqual({ ranking: ['atmosphere', 'plot', 'characters'] });
  });
});

describe('Q03 ranking idempotency', () => {
  it('returns the existing answer without re-processing when the idempotency key matches', async () => {
    const { service, prisma, evidenceFactory, profiles } = serviceWith();
    (prisma as unknown as { questionAnswer: { findUnique: unknown } }).questionAnswer.findUnique = vi.fn().mockResolvedValue({ id: 'prev-answer' });
    await service.submitAnswer('s1', 'Q03_PRIORITY_RANKING', { response: { ranking: ['characters', 'atmosphere', 'plot'] }, idempotencyKey: 'idem-1' }, 'u1');
    expect(evidenceFactory.createMany).not.toHaveBeenCalled();
    expect(profiles.recompute).not.toHaveBeenCalled();
  });
});
