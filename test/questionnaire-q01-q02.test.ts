import { describe, expect, it, vi } from 'vitest';
import { QuestionDefinition } from '@prisma/client';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { PrismaService } from '../src/prisma/prisma.service';

const Q01 = {
  id: 'q01',
  questionKey: 'Q01_LOVED_BOOKS',
  version: 1,
  questionnaireVersion: 'onboarding/1.1',
  responseType: 'book_search',
  isRequired: false,
  textEsMx: 'Agrega libros que hayas disfrutado.',
  validationJson: null,
  optionMappings: [],
} as unknown as QuestionDefinition;

const SESSION = {
  id: 's1',
  userId: 'u1',
  status: 'started',
  questionnaireVersion: 'onboarding/1.1',
  answers: [],
};

function serviceWith(q02Answers: Array<{ id: string; normalizedResponse: unknown }> = []) {
  const deleteManyCalls: Array<{ where: { id?: { in?: string[] }; sessionId?: string; questionKey?: string } }> = [];
  const tx = {
    questionAnswer: {
      findMany: vi.fn().mockImplementation((args: { where: { questionKey?: string } }) => {
        if (args.where.questionKey === 'Q02_DISLIKED_BOOK') return Promise.resolve(q02Answers);
        return Promise.resolve([]);
      }),
      create: vi.fn().mockResolvedValue({ id: 'new-answer' }),
      deleteMany: vi.fn().mockImplementation((args: { where: { id?: { in?: string[] } } }) => {
        deleteManyCalls.push(args);
        return Promise.resolve({ count: 1 });
      }),
    },
    readerEvidence: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerPositiveTriggerEvidence: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerConditionalRule: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    readerPositiveTrigger: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma = {
    questionnaireSession: { findUnique: vi.fn().mockResolvedValue(SESSION) },
    questionAnswer: { findUnique: vi.fn().mockResolvedValue(null) },
    questionDefinition: { findUnique: vi.fn().mockResolvedValue(Q01), findMany: vi.fn().mockResolvedValue([Q01]) },
    $transaction: vi.fn().mockImplementation((run: (t: unknown) => Promise<unknown>) => run(tx)),
  } as unknown as PrismaService;
  const profiles = { ensureProfile: vi.fn().mockResolvedValue({ id: 'p1' }), recompute: vi.fn().mockResolvedValue({}) } as unknown as ProfileService;
  const evidenceFactory = { createMany: vi.fn().mockResolvedValue(undefined) } as unknown as EvidenceFactory;
  const service = new QuestionnaireService(prisma, profiles, evidenceFactory, {} as never, {} as never, {} as never);
  return { service, deleteManyCalls };
}

const lovedBooksResponse = { books: [{ work_id: 'OL1W', liked_aspects: ['characters'], rating: 5 }] };

describe('Q01 loved books re-answer clears the auto-skip on Q02', () => {
  it('deletes a skipped Q02 answer when Q01 is answered with real books', async () => {
    const { service, deleteManyCalls } = serviceWith([
      { id: 'q02-skip', normalizedResponse: { skipped: true } },
      { id: 'q02-real', normalizedResponse: { books: [] } },
    ]);
    await service.submitAnswer('s1', 'Q01_LOVED_BOOKS', { response: lovedBooksResponse, idempotencyKey: 'idem-1' }, 'u1');
    expect(deleteManyCalls).toContainEqual({ where: { id: { in: ['q02-skip'] } } });
    expect(deleteManyCalls).not.toContainEqual({ where: { id: { in: ['q02-real'] } } });
  });

  it('does not delete any Q02 answer when Q01 is answered as skipped (never read)', async () => {
    const { service, deleteManyCalls } = serviceWith([
      { id: 'q02-skip', normalizedResponse: { skipped: true } },
    ]);
    await service.submitAnswer('s1', 'Q01_LOVED_BOOKS', { response: { skipped: true }, idempotencyKey: 'idem-1' }, 'u1');
    expect(deleteManyCalls).toEqual([]);
  });
});
