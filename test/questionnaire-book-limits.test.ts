import { describe, expect, it, vi } from 'vitest';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { PrismaService } from '../src/prisma/prisma.service';

function serviceWith(validation: Record<string, unknown>) {
  const prisma = { $transaction: vi.fn() } as unknown as PrismaService;
  const profiles = {} as unknown as ProfileService;
  const evidenceFactory = {} as unknown as EvidenceFactory;
  const service = new QuestionnaireService(prisma, profiles, evidenceFactory, {} as never, {} as never, {} as never);
  const question = {
    questionKey: 'Q01_LOVED_BOOKS',
    questionnaireVersion: 'onboarding/1.1',
    validationJson: validation,
  };
  return { service, question };
}

const LIMITS = { minItems: 1, maxItems: 20, likedAspectsRequired: true };

function lovedBooks(count: number) {
  return { books: Array.from({ length: count }, (_, index) => ({ work_id: `OL${index}W`, edition_id: null, title: `Libro ${index}`, rating: 4, liked_aspects: ['prose'] })) };
}

function dislikedBooks(count: number) {
  return { books: Array.from({ length: count }, (_, index) => ({ work_id: `OL${index}W`, edition_id: null, title: `Libro ${index}`, rating: 2, reason_codes: ['too_slow'], free_text: null })) };
}

describe('book search limits', () => {
  const normalize = (service: QuestionnaireService, question: Record<string, unknown>, response: Record<string, unknown>) =>
    (service as unknown as { normalizeBookSearch(question: unknown, response: Record<string, unknown>): unknown }).normalizeBookSearch(question, response);

  it('rejects an empty book list', () => {
    const { service, question } = serviceWith(LIMITS);
    expect(() => normalize(service, question, { books: [] })).toThrow(/non-empty "books"/);
  });

  it('accepts a single book', () => {
    const { service, question } = serviceWith(LIMITS);
    expect(() => normalize(service, question, lovedBooks(1))).not.toThrow();
  });

  it('rejects more than maxItems books', () => {
    const { service, question } = serviceWith(LIMITS);
    expect(() => normalize(service, question, lovedBooks(21))).toThrow(/maximum of 20 books/);
  });

  it('accepts up to maxItems books', () => {
    const { service, question } = serviceWith(LIMITS);
    expect(() => normalize(service, question, lovedBooks(20))).not.toThrow();
  });

  it('keeps a valid Open Library cover ID with questionnaire books', () => {
    const { service, question } = serviceWith(LIMITS);
    const response = lovedBooks(2) as { books: Array<Record<string, unknown>> };
    response.books[0]!.cover_id = 15242046;

    expect(normalize(service, question, response)).toEqual({
      books: [
        { work_id: 'OL0W', edition_id: null, cover_id: 15242046, rating: 4, liked_aspects: ['prose'], free_text: null },
        { work_id: 'OL1W', edition_id: null, cover_id: null, rating: 4, liked_aspects: ['prose'], free_text: null },
      ],
    });
  });

  it('rejects books without a rating', () => {
    const { service, question } = serviceWith(LIMITS);
    const response = lovedBooks(2) as { books: Array<Record<string, unknown>> };
    delete response.books[0]!.rating;
    expect(() => normalize(service, question, response)).toThrow(/rating from 1 to 5/);
  });

  it('rejects books with an out-of-range rating', () => {
    const { service, question } = serviceWith(LIMITS);
    const response = lovedBooks(2) as { books: Array<Record<string, unknown>> };
    response.books[1]!.rating = 7;
    expect(() => normalize(service, question, response)).toThrow(/rating from 1 to 5/);
  });

  it('rejects an invalid Open Library cover ID', () => {
    const { service, question } = serviceWith(LIMITS);
    const response = lovedBooks(2) as { books: Array<Record<string, unknown>> };
    response.books[0]!.cover_id = -1;
    expect(() => normalize(service, question, response)).toThrow(/invalid cover_id/);
  });

  it('applies the same limits to disliked books', () => {
    const { service } = serviceWith({ minItems: 1, maxItems: 20, reasonCodesRequired: true });
    const disliked = { ...serviceWith({ minItems: 1, maxItems: 20, reasonCodesRequired: true }).question, questionKey: 'Q02_DISLIKED_BOOK' };
    expect(() => normalize(service, disliked, { books: [] })).toThrow(/non-empty "books"/);
    expect(() => normalize(service, disliked, dislikedBooks(21))).toThrow(/maximum of 20 books/);
    expect(() => normalize(service, disliked, dislikedBooks(1))).not.toThrow();
    expect(() => normalize(service, disliked, dislikedBooks(20))).not.toThrow();
  });
});
