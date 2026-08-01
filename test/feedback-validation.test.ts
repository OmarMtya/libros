import { describe, expect, it } from 'vitest';
import { validateFeedbackPayload } from '../src/feedback/feedback-validation';

function basePayload(overrides: Partial<Parameters<typeof validateFeedbackPayload>[0]> = {}) {
  return {
    started: true,
    readingStatus: 'completed' as const,
    completionPercentage: 100,
    ...overrides,
  };
}

describe('validateFeedbackPayload', () => {
  it('rechaza un libro iniciado que incluye notStartedReason', () => {
    expect(() => validateFeedbackPayload(basePayload({ started: true, notStartedReason: 'no_time' }))).toThrow();
  });

  it('acepta un libro iniciado sin notStartedReason', () => {
    expect(() => validateFeedbackPayload(basePayload({ started: true }))).not.toThrow();
  });

  it('rechaza un libro no iniciado sin reason, con status distinto de not_started o completion distinto de 0', () => {
    expect(() => validateFeedbackPayload(basePayload({ started: false, readingStatus: 'completed', completionPercentage: 100 }))).toThrow();
    expect(() => validateFeedbackPayload(basePayload({ started: false, readingStatus: 'not_started', completionPercentage: 0 }))).toThrow();
  });

  it('acepta un libro no iniciado con reason, status not_started y 0%', () => {
    expect(() => validateFeedbackPayload(basePayload({ started: false, readingStatus: 'not_started', completionPercentage: 0, notStartedReason: 'no_time' }))).not.toThrow();
  });

  it('rechaza un libro iniciado con status not_started', () => {
    expect(() => validateFeedbackPayload(basePayload({ readingStatus: 'not_started' }))).toThrow();
  });
});
