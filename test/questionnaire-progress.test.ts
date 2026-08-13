import { describe, expect, it, vi } from 'vitest';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { PrismaService } from '../src/prisma/prisma.service';

const DEFINITIONS = [
  {
    id: 'd1', questionKey: 'Q03_PRIORITY_RANKING', version: 1, questionnaireVersion: 'onboarding/1.1',
    responseType: 'ranking', isRequired: true, textEsMx: 'Q3', validationJson: null,
    optionMappings: [], displayOrder: 3, isActive: true, createdAt: new Date(), branchingRulesJson: null,
  },
  {
    id: 'd2', questionKey: 'Q04_HOOK_NEED', version: 1, questionnaireVersion: 'onboarding/1.1',
    responseType: 'scale', isRequired: true, textEsMx: 'Q4', validationJson: null,
    optionMappings: [], displayOrder: 4, isActive: true, createdAt: new Date(), branchingRulesJson: null,
  },
  {
    id: 'd3', questionKey: 'Q05_SLOW_BURN_TOLERANCE', version: 1, questionnaireVersion: 'onboarding/1.1',
    responseType: 'scale', isRequired: false, textEsMx: 'Q5', validationJson: null,
    optionMappings: [], displayOrder: 5, isActive: true, createdAt: new Date(), branchingRulesJson: null,
  },
  {
    id: 'd4', questionKey: 'Q05A_SLOW_BURN_CONDITIONS', version: 1, questionnaireVersion: 'onboarding/1.1',
    responseType: 'multi_select', isRequired: false, textEsMx: 'Q5A', validationJson: null,
    optionMappings: [], displayOrder: 6, isActive: true, createdAt: new Date(), branchingRulesJson: null,
  },
  {
    id: 'd5', questionKey: 'Q06_STYLE_FRAGMENT', version: 1, questionnaireVersion: 'onboarding/1.1',
    responseType: 'single_select', isRequired: false, textEsMx: 'Q6', validationJson: null,
    optionMappings: [], displayOrder: 7, isActive: true, createdAt: new Date(), branchingRulesJson: null,
  },
];

const SESSION = {
  id: 's1',
  userId: 'u1',
  status: 'started',
  questionnaireVersion: 'onboarding/1.1',
};

function serviceWith(answers: Array<{ questionKey: string; normalizedResponse: unknown }> = []) {
  const prisma = {
    questionnaireSession: { findUnique: vi.fn().mockResolvedValue({ ...SESSION, answers }) },
    questionDefinition: { findMany: vi.fn().mockResolvedValue(DEFINITIONS) },
  } as unknown as PrismaService;
  const profiles = {} as unknown as ProfileService;
  const evidenceFactory = {} as unknown as EvidenceFactory;
  const service = new QuestionnaireService(prisma, profiles, evidenceFactory, {} as never, {} as never, {} as never);
  return { service, prisma };
}

const answer = (questionKey: string, normalizedResponse: unknown) => ({ questionKey, normalizedResponse });

describe('questionnaire progress', () => {
  it('reports position and total for the first question of a fresh session', async () => {
    const { service } = serviceWith();
    const result = await service.nextQuestion('s1', 'u1');
    expect(result).toMatchObject({ questionKey: 'Q03_PRIORITY_RANKING', position: 1, totalQuestions: 4 });
  });

  it('counts only visible questions in the total', async () => {
    const { service } = serviceWith([
      answer('Q03_PRIORITY_RANKING', { ranking: ['plot', 'style', 'emotion'] }),
      answer('Q04_HOOK_NEED', { value: 0.25 }),
    ]);
    const result = await service.nextQuestion('s1', 'u1');
    expect(result).toMatchObject({ questionKey: 'Q05_SLOW_BURN_TOLERANCE', position: 3, totalQuestions: 4 });
  });

  it('reveals the conditional question when its dependency is answered high enough', async () => {
    const { service } = serviceWith([
      answer('Q03_PRIORITY_RANKING', { ranking: ['plot', 'style', 'emotion'] }),
      answer('Q04_HOOK_NEED', { value: 0.25 }),
      answer('Q05_SLOW_BURN_TOLERANCE', { value: 0.5 }),
    ]);
    const result = await service.nextQuestion('s1', 'u1');
    expect(result).toMatchObject({ questionKey: 'Q05A_SLOW_BURN_CONDITIONS', position: 4, totalQuestions: 5 });
  });

  it('skips the conditional question and drops it from the total when the dependency is low', async () => {
    const { service } = serviceWith([
      answer('Q03_PRIORITY_RANKING', { ranking: ['plot', 'style', 'emotion'] }),
      answer('Q04_HOOK_NEED', { value: 0.25 }),
      answer('Q05_SLOW_BURN_TOLERANCE', { value: 0 }),
    ]);
    const result = await service.nextQuestion('s1', 'u1');
    expect(result).toMatchObject({ questionKey: 'Q06_STYLE_FRAGMENT', position: 4, totalQuestions: 4 });
  });

  it('returns the position of an answered question when going back', async () => {
    const { service, prisma } = serviceWith([answer('Q05_SLOW_BURN_TOLERANCE', { value: 0.5 })]);
    (prisma as unknown as { questionDefinition: { findUnique: unknown } }).questionDefinition.findUnique = vi
      .fn()
      .mockResolvedValue(DEFINITIONS.find((item) => item.questionKey === 'Q05_SLOW_BURN_TOLERANCE'));
    const result = await service.getQuestionWithResponse('s1', 'Q05_SLOW_BURN_TOLERANCE', 'u1');
    expect(result).toMatchObject({ questionKey: 'Q05_SLOW_BURN_TOLERANCE', position: 3, totalQuestions: 5 });
  });
});
