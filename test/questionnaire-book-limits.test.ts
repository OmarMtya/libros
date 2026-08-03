import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { PrismaService } from '../src/prisma/prisma.service';

function serviceWith(validation: Record<string, unknown>) {
  const prisma = { $transaction: vi.fn() } as unknown as PrismaService;
  const profiles = {} as unknown as ProfileService;
  const evidenceFactory = {} as unknown as EvidenceFactory;
  const service = new QuestionnaireService(prisma, profiles, evidenceFactory, {} as never);
  const question = {
    questionKey: 'Q01_LOVED_BOOKS',
    questionnaireVersion: 'onboarding/1.1',
    validationJson: validation,
  };
  return { service, question };
}

function lovedBooks(count: number) {
  return { books: Array.from({ length: count }, (_, index) => ({ work_id: `OL${index}W`, edition_id: null, title: `Libro ${index}`, liked_aspects: ['prose'] })) };
}

function dislikedBooks(count: number) {
  return { books: Array.from({ length: count }, (_, index) => ({ work_id: `OL${index}W`, edition_id: null, title: `Libro ${index}`, reason_codes: ['too_slow'], free_text: null })) };
}

describe('book search limits', () => {
  const normalize = (service: QuestionnaireService, question: Record<string, unknown>, response: Record<string, unknown>) =>
    (service as unknown as { normalizeBookSearch(question: unknown, response: Record<string, unknown>): unknown }).normalizeBookSearch(question, response);

  it('rejects fewer than minItems books', () => {
    const { service, question } = serviceWith({ minItems: 3, maxItems: 20, likedAspectsRequired: true });
    expect(() => normalize(service, question, lovedBooks(2))).toThrow(BadRequestException);
    expect(() => normalize(service, question, lovedBooks(2))).toThrow(/minimum of 3 books/);
  });

  it('rejects more than maxItems books', () => {
    const { service, question } = serviceWith({ minItems: 3, maxItems: 20, likedAspectsRequired: true });
    expect(() => normalize(service, question, lovedBooks(21))).toThrow(/maximum of 20 books/);
  });

  it('accepts between minItems and maxItems for loved books', () => {
    const { service, question } = serviceWith({ minItems: 3, maxItems: 20, likedAspectsRequired: true });
    expect(() => normalize(service, question, lovedBooks(3))).not.toThrow();
    expect(() => normalize(service, question, lovedBooks(20))).not.toThrow();
  });

  it('applies the same limits to disliked books', () => {
    const { service } = serviceWith({ minItems: 3, maxItems: 20, reasonCodesRequired: true });
    const disliked = { ...serviceWith({ minItems: 3, maxItems: 20, reasonCodesRequired: true }).question, questionKey: 'Q02_DISLIKED_BOOK' };
    expect(() => normalize(service, disliked, dislikedBooks(2))).toThrow(/minimum of 3 books/);
    expect(() => normalize(service, disliked, dislikedBooks(21))).toThrow(/maximum of 20 books/);
    expect(() => normalize(service, disliked, dislikedBooks(3))).not.toThrow();
    expect(() => normalize(service, disliked, dislikedBooks(20))).not.toThrow();
  });
});
