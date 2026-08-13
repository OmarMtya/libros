import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CatalogService } from '../src/books/catalog.service';
import { BooksService } from '../src/books/books.service';
import { BOOK_FEATURE_SCHEMA_VERSION } from '../src/catalog/book-feature-definitions';
import { CONTENT_TYPE_SCHEMA_VERSION } from '../src/catalog/content-type-definitions';
import { TAG_TAXONOMY_VERSION } from '../src/profile/catalog';
import { ProfileService } from '../src/profile/profile.service';
import { PublicProfileService } from '../src/profile/public-profile.service';
import { assertTestDatabase } from './helpers/test-database';

const url = process.env.TEST_DATABASE_URL;
const run = describe.runIf(Boolean(url));
assertTestDatabase(url);

const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const profileService = prisma ? new ProfileService(prisma as never) : null;
const publicService = prisma ? new PublicProfileService(prisma as never) : null;
const catalogService = prisma ? new CatalogService(prisma as never, new BooksService()) : null;

const REQUIRED_FICTION_FEATURES = [
  'hook_speed', 'narrative_pace', 'slow_burn_level', 'narrative_payoff', 'style_clarity',
  'ornate_prose', 'linguistic_complexity', 'structural_complexity', 'conceptual_density',
  'character_depth', 'character_agency', 'character_likability', 'relationship_focus',
  'cast_size_load', 'multi_pov_load', 'introspection_density', 'repetition_level',
  'tension_level', 'descriptive_density', 'worldbuilding_load', 'ending_openness',
];

let isbnSequence = 0;
const nextIsbn = () => `9780${String(++isbnSequence).padStart(9, '0')}`;

async function cleanDatabase() {
  if (!prisma) return;
  await prisma.curatorActionAudit.deleteMany();
  await prisma.recommendationCandidate.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.profileVersionEvidence.deleteMany();
  await prisma.readerProfileVersion.deleteMany();
  await prisma.readerEvidence.deleteMany();
  await prisma.readerPositiveTriggerEvidence.deleteMany();
  await prisma.readerPositiveTrigger.deleteMany();
  await prisma.readerConditionalRule.deleteMany();
  await prisma.readerTagEvidence.deleteMany();
  await prisma.readerTagPreference.deleteMany();
  await prisma.readerOperationalConstraints.deleteMany();
  await prisma.readerProfileDimension.deleteMany();
  await prisma.readerProfile.deleteMany();
  await prisma.questionAnswer.deleteMany();
  await prisma.questionnaireSession.deleteMany();
  await prisma.readingFeedbackAspect.deleteMany();
  await prisma.readingFeedback.deleteMany();
  await prisma.feedbackInvitation.deleteMany();
  await prisma.curationAssignment.deleteMany();
  await prisma.bookTag.deleteMany();
  await prisma.bookFeature.deleteMany();
  await prisma.bookClassificationVersion.deleteMany();
  await prisma.editionContributor.deleteMany();
  await prisma.bookEdition.deleteMany();
  await prisma.bookAuthor.deleteMany();
  await prisma.author.deleteMany();
  await prisma.book.deleteMany();
  await prisma.user.deleteMany();
}

async function createReader(completed: boolean) {
  const userId = randomUUID();
  await prisma!.user.create({ data: { id: userId, email: `${userId.slice(0, 8)}@test.dev`, displayName: 'Lector Público', avatarUrl: 'https://cdn.example/avatar.jpg' } });
  const profile = await profileService!.ensureProfile(userId);
  if (completed) {
    await prisma!.questionnaireSession.create({ data: { userId, questionnaireVersion: 'onboarding/1.1', status: 'completed', completedAt: new Date() } });
    await prisma!.readerTagPreference.create({ data: { profileId: profile.id, tagKey: 'science_fiction', tagType: 'genre', affinity: 0.8 } });
    await prisma!.readerTagPreference.create({ data: { profileId: profile.id, tagKey: 'literary_fiction', tagType: 'genre', affinity: -0.4 } });
    await prisma!.readerOperationalConstraints.create({
      data: { profileId: profile.id, preferredPagesMin: 150, preferredPagesMax: 350, seriesPreference: 'standalone_preferred', acceptedLanguagesJson: ['es'], acceptedFormatsJson: ['physical'] },
    });
  }
  return { userId, profile };
}

async function makeApprovedEdition() {
  const catalog = catalogService!;
  const actor = '00000000-0000-0000-0000-0000000000aa';
  const book = await catalog.createBook(actor, { canonicalTitle: `Eligh ${randomUUID().slice(0, 6)}`, originalLanguage: 'es' });
  const edition = await catalog.addEdition(book.id, {
    title: 'Eligh (ed. es)',
    isbn: nextIsbn(),
    languageCode: 'es',
    pages: 248,
    publisher: 'Editorial',
    publicationYear: 2023,
  });
  await catalog.createClassification(actor, edition.id, {
    contentTypeKey: 'fiction',
    contentTypeSchemaVersion: CONTENT_TYPE_SCHEMA_VERSION,
    featureSchemaVersion: BOOK_FEATURE_SCHEMA_VERSION,
    tagTaxonomyVersion: TAG_TAXONOMY_VERSION,
    features: REQUIRED_FICTION_FEATURES.map((featureKey) => ({ featureKey, value: 0.7, confidence: 0.6 })),
    tags: [{ tagKey: 'science_fiction', strength: 0.9, confidence: 0.7 }],
  });
  return { book, edition };
}

run('public-profile (integration)', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma?.$disconnect();
  });

  it('assigns a unique public slug to every profile', async () => {
    const { profile } = await createReader(true);
    expect(profile.publicSlug).toBeTruthy();
    const slug = profile.publicSlug!;
    expect(slug).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('exposes a curated public view without sensitive data', async () => {
    const { profile } = await createReader(true);
    const view = await publicService!.get(profile.publicSlug!);
    expect(view.slug).toBe(profile.publicSlug);
    expect(view.displayName).toBe('Lector Público');
    expect(view.avatarUrl).toBe('https://cdn.example/avatar.jpg');
    expect(view.aiDescriptionStatus).toBe('none');
    expect(view.categories.liked).toHaveLength(1);
    expect(view.categories.liked[0]!.key).toBe('science_fiction');
    expect(view.categories.notInterested[0]!.key).toBe('literary_fiction');
    expect(view.constraints?.preferredPagesMin).toBe(150);
    expect(view.constraints?.seriesPreference).toBe('standalone_preferred');
    expect(JSON.stringify(view)).not.toContain('@test.dev');
    expect(JSON.stringify(view)).not.toContain('reader_profiles');
    expect(JSON.stringify(view)).not.toContain('overallConfidence');
  });

  it('rejects unknown slugs', async () => {
    await expect(publicService!.get('no-such-slug')).rejects.toThrow('Perfil no encontrado');
  });

  it('returns a pending public view for profiles without a completed questionnaire', async () => {
    const { profile } = await createReader(false);
    const view = await publicService!.get(profile.publicSlug!);
    expect(view.notReady).toBe(true);
    expect(view.isOwner).toBe(false);
    expect(view.displayName).toBe('Lector Público');
    expect(view.books.enjoyed).toEqual([]);
    expect(view.categories.liked).toEqual([]);
  });

  it('returns notReady for the owner without a completed questionnaire', async () => {
    const { userId, profile } = await createReader(false);
    const view = await publicService!.get(profile.publicSlug!, userId);
    expect(view.notReady).toBe(true);
    expect(view.isOwner).toBe(true);
    expect(view.slug).toBe(profile.publicSlug);
  });

  it('builds questionnaire book covers from cover_id when present', async () => {
    const { userId, profile } = await createReader(true);
    const session = await prisma!.questionnaireSession.findFirstOrThrow({ where: { userId, status: 'completed' } });
    const raw = {
      books: [
        { work_id: 'OL1673205W', edition_id: 'OL9134091M', cover_id: 8455754, title: 'El padrino', rating: 5, liked_aspects: ['universe'], free_text: 'Me atrapó su mundo.' },
        { work_id: 'OL82563W', edition_id: 'OL38565767M', title: 'Harry Potter y la piedra filosofal', rating: 4, liked_aspects: ['characters'], free_text: null },
      ],
    };
    await prisma!.questionAnswer.create({
      data: { sessionId: session.id, userId, questionKey: 'Q01_LOVED_BOOKS', questionVersion: 1, questionnaireVersion: 'onboarding/1.1', rawResponse: raw as never, normalizedResponse: raw as never },
    });
    const view = await publicService!.get(profile.publicSlug!);
    expect(view.books.enjoyed).toHaveLength(2);
    expect(view.books.enjoyed[0]!.coverUrl).toBe('https://covers.openlibrary.org/b/id/8455754-L.jpg');
    expect(view.books.enjoyed[1]!.coverUrl).toBeNull();
    expect(view.books.enjoyed[0]!.source).toEqual(['questionnaire']);
    expect(view.books.enjoyed[0]!.review).toMatchObject({
      selectionFitRating: 5,
      positiveAspects: ['universe'],
      freeText: 'Me atrapó su mundo.',
      readingStatus: null,
    });
    expect(view.books.enjoyed[1]!.review?.selectionFitRating).toBe(4);
  });

  it('marks books read via Mi Libro Sorpresa with the surprise source', async () => {
    const { userId, profile } = await createReader(true);
    const { book, edition } = await makeApprovedEdition();
    await prisma!.readingFeedback.create({
      data: {
        userId,
        bookId: book.id,
        bookEditionId: edition.id,
        bookClassificationVersionId: null,
        feedbackVersion: 'feedback/1.0',
        started: true,
        readingStatus: 'completed',
        completionPercentage: 100,
        selectionFitRating: 4,
        isFinal: true,
        learningStatus: 'processed',
      },
    });
    const view = await publicService!.get(profile.publicSlug!);
    const entry = view.books.enjoyed.find((item) => item.title === book.canonicalTitle);
    expect(entry).toBeTruthy();
    expect(entry!.source).toEqual(['surprise']);
    expect(entry!.review?.readingStatus).toBe('completed');
    expect(entry!.review?.selectionFitRating).toBe(4);
  });

  it('merges sources when a declared book was later read via Mi Libro Sorpresa', async () => {
    const { userId, profile } = await createReader(true);
    const { book, edition } = await makeApprovedEdition();
    const session = await prisma!.questionnaireSession.findFirstOrThrow({ where: { userId, status: 'completed' } });
    await prisma!.questionAnswer.create({
      data: {
        sessionId: session.id, userId, questionKey: 'Q01_LOVED_BOOKS', questionVersion: 1, questionnaireVersion: 'onboarding/1.1',
        rawResponse: { books: [{ work_id: 'OL1W', edition_id: null, cover_id: null, title: book.canonicalTitle, rating: 4, liked_aspects: ['characters'], free_text: null }] } as never,
        normalizedResponse: { books: [] } as never,
      },
    });
    await prisma!.readingFeedback.create({
      data: {
        userId,
        bookId: book.id,
        bookEditionId: edition.id,
        bookClassificationVersionId: null,
        feedbackVersion: 'feedback/1.0',
        started: true,
        readingStatus: 'completed',
        completionPercentage: 100,
        selectionFitRating: 5,
        isFinal: true,
        learningStatus: 'processed',
      },
    });
    const view = await publicService!.get(profile.publicSlug!);
    const entry = view.books.enjoyed.find((item) => item.title === book.canonicalTitle);
    expect(entry).toBeTruthy();
    expect(entry!.source).toEqual(['surprise', 'questionnaire']);
    expect(entry!.review?.selectionFitRating).toBe(5);
  });
});
