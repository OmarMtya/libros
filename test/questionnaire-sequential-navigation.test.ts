import { describe, expect, it, vi } from 'vitest';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { PrismaService } from '../src/prisma/prisma.service';

const definitions = [
  { questionKey: 'Q01_LOVED_BOOKS', responseType: 'book_search', isRequired: false, optionMappings: [], displayOrder: 1 },
  { questionKey: 'Q02_DISLIKED_BOOK', responseType: 'single_select', isRequired: false, optionMappings: [{ optionKey: 'option', evidenceMappingsJson: [] }], displayOrder: 2 },
  { questionKey: 'Q03_PRIORITY_RANKING', responseType: 'ranking', isRequired: true, optionMappings: [], displayOrder: 3 },
  { questionKey: 'Q04_HOOK_NEED', responseType: 'scale', isRequired: true, optionMappings: [], displayOrder: 4 },
].map((question, index) => ({
  id: `q${index + 1}`,
  version: 1,
  questionnaireVersion: 'onboarding/1.1',
  textEsMx: question.questionKey,
  validationJson: question.questionKey === 'Q03_PRIORITY_RANKING' ? { allowed: ['plot', 'characters', 'emotion'] } : null,
  ...question,
}));

const session = { id: 's1', userId: 'u1', status: 'started', questionnaireVersion: 'onboarding/1.1' };

describe('questionnaire sequential navigation', () => {
  it('advances to the next question even when later questions already have answers', async () => {
    const sessionAfterAnswer = {
      ...session,
      answers: [
        { questionKey: 'Q02_DISLIKED_BOOK', normalizedResponse: { optionKeys: ['option'] } },
        { questionKey: 'Q03_PRIORITY_RANKING', normalizedResponse: { ranking: ['plot', 'characters', 'emotion'] } },
        { questionKey: 'Q04_HOOK_NEED', normalizedResponse: { value: 0.75 } },
      ],
    };
    const tx = {
      questionAnswer: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'answer' }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      readerEvidence: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      readerPositiveTriggerEvidence: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      readerConditionalRule: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      readerPositiveTrigger: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      questionnaireSession: { findUnique: vi.fn().mockResolvedValueOnce(session).mockResolvedValue(sessionAfterAnswer) },
      questionAnswer: { findUnique: vi.fn().mockResolvedValue(null) },
      questionDefinition: {
        findUnique: vi.fn().mockResolvedValue(definitions[1]),
        findMany: vi.fn().mockResolvedValue(definitions),
      },
      $transaction: vi.fn().mockImplementation((run: (transaction: unknown) => Promise<unknown>) => run(tx)),
    } as unknown as PrismaService;
    const profiles = { ensureProfile: vi.fn().mockResolvedValue({ id: 'profile' }) } as unknown as ProfileService;
    const evidenceFactory = { createMany: vi.fn().mockResolvedValue(undefined) } as unknown as EvidenceFactory;
    const service = new QuestionnaireService(prisma, profiles, evidenceFactory, {} as never, {} as never, {} as never);

    const result = await service.submitAnswer('s1', 'Q02_DISLIKED_BOOK', { response: 'option' }, 'u1');

    expect(result.nextQuestion).toMatchObject({ questionKey: 'Q03_PRIORITY_RANKING', position: 3, totalQuestions: 4 });
  });
});
