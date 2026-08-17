import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CatalogService } from '../src/books/catalog.service';
import { BooksService } from '../src/books/books.service';
import { CurationService } from '../src/curation/curation.service';
import { CuratorAuditService } from '../src/curation/curator-audit.service';
import { EmailService } from '../src/email/email.service';
import { FeedbackInvitationService } from '../src/feedback/feedback-invitation.service';
import { ProfileService } from '../src/profile/profile.service';
import { ScoringService } from '../src/scoring/scoring.service';
import { buildPriorityVector } from '../src/scoring/priority-vector';
import { BOOK_FEATURE_SCHEMA_VERSION } from '../src/catalog/book-feature-definitions';
import { CONTENT_TYPE_SCHEMA_VERSION } from '../src/catalog/content-type-definitions';
import { TAG_TAXONOMY_VERSION } from '../src/profile/catalog';
import { assertTestDatabase } from './helpers/test-database';

const url = process.env.TEST_DATABASE_URL;
const run = describe.runIf(Boolean(url));
assertTestDatabase(url);

const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const catalogService = prisma ? new CatalogService(prisma as never, new BooksService()) : null;
const profileService = prisma ? new ProfileService(prisma as never) : null;
const scoringService = prisma ? new ScoringService(prisma as never, profileService!) : null;
const curationService = prisma ? new CurationService(prisma as never, new FeedbackInvitationService(), new CuratorAuditService(prisma as never), new EmailService()) : null;

const REQUIRED_FICTION_FEATURES = [
  'hook_speed', 'narrative_pace', 'slow_burn_level', 'narrative_payoff', 'style_clarity',
  'ornate_prose', 'linguistic_complexity', 'structural_complexity', 'conceptual_density',
  'character_depth', 'character_agency', 'character_likability', 'relationship_focus',
  'cast_size_load', 'multi_pov_load', 'introspection_density', 'repetition_level',
  'tension_level', 'descriptive_density', 'worldbuilding_load', 'ending_openness',
];

let sequence = 0;
let isbnSequence = 0;
const nextIsbn = () => `9780${String(++isbnSequence).padStart(9, '0')}`;

async function cleanDatabase() {
  if (!prisma) return;
  await prisma.curatorActionAudit.deleteMany();
  await prisma.recommendationCandidate.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.readingFeedbackAspect.deleteMany();
  await prisma.readingFeedback.deleteMany();
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
  await prisma.curationAssignment.deleteMany();
  await prisma.feedbackInvitation.deleteMany();
  await prisma.bookTag.deleteMany();
  await prisma.bookFeature.deleteMany();
  await prisma.bookClassificationVersion.deleteMany();
  await prisma.editionContributor.deleteMany();
  await prisma.bookEdition.deleteMany();
  await prisma.bookAuthor.deleteMany();
  await prisma.author.deleteMany();
  await prisma.book.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
}

async function makeApprovedEdition() {
  const actor = '00000000-0000-0000-0000-0000000000aa';
  const book = await catalogService!.createBook(actor, { canonicalTitle: `Eligh ${++sequence}`, originalLanguage: 'es' });
  const edition = await catalogService!.addEdition(book.id, {
    title: 'Eligh (ed. es)',
    isbn: nextIsbn(),
    languageCode: 'es',
    pages: 248,
    publisher: 'Editorial',
    publicationYear: 2023,
  });
  const classification = await catalogService!.createClassification(actor, edition.id, {
    contentTypeKey: 'fiction',
    contentTypeSchemaVersion: CONTENT_TYPE_SCHEMA_VERSION,
    featureSchemaVersion: BOOK_FEATURE_SCHEMA_VERSION,
    tagTaxonomyVersion: TAG_TAXONOMY_VERSION,
    features: REQUIRED_FICTION_FEATURES.map((featureKey) => ({ featureKey, value: 0.7, confidence: 0.6 })),
    tags: [
      { tagKey: 'science_fiction', strength: 0.9, confidence: 0.7 },
      { tagKey: 'identity', strength: 0.6, confidence: 0.6 },
      { tagKey: 'space_opera', strength: 0.8, confidence: 0.7 },
    ],
  });
  const approved = await catalogService!.approve(actor, classification.id);
  return { book, edition, classification: approved };
}

async function makeReadyReader() {
  const userId = randomUUID();
  await prisma!.user.create({ data: { id: userId } });
  const profile = await profileService!.ensureProfile(userId);
  const dims = [
    { dimensionKey: 'hook_need', value: 0.8, confidence: 0.6 },
    { dimensionKey: 'pace_preference', value: 0.7, confidence: 0.5 },
    { dimensionKey: 'tension_preference', value: 0.85, confidence: 0.5 },
    { dimensionKey: 'comfort_preference', value: 0.4, confidence: 0.3 },
  ];
  for (const dimension of dims) {
    await prisma!.readerProfileDimension.update({
      where: { profileId_dimensionKey: { profileId: profile.id, dimensionKey: dimension.dimensionKey } },
      data: { value: dimension.value, confidence: dimension.confidence },
    });
  }
  await prisma!.readerOperationalConstraints.create({
    data: {
      profileId: profile.id,
      preferredPagesMin: 180,
      preferredPagesMax: 420,
      seriesPreference: 'no_preference',
      acceptedLanguagesJson: ['es'],
      acceptedFormatsJson: ['physical'],
    },
  });
  const session = await prisma!.questionnaireSession.create({ data: { userId, questionnaireVersion: 'onboarding/1.1' } });
  const priorityVector = buildPriorityVector(['plot', 'characters', 'emotion']);
  await prisma!.questionAnswer.create({
    data: {
      sessionId: session.id,
      userId,
      questionKey: 'Q03_PRIORITY_RANKING',
      questionVersion: 2,
      questionnaireVersion: 'onboarding/1.1',
      rawResponse: { ranking: ['plot', 'characters', 'emotion'] },
      normalizedResponse: { ranking: ['plot', 'characters', 'emotion'], priorityVector },
    },
  });
  return { userId, profile };
}

async function makeOrderFulfillment(userId: string) {
  const pkg = await prisma!.productPackage.findFirst({ where: { isActive: true }, orderBy: { priceCents: 'asc' } });
  if (!pkg) throw new Error('No hay paquete sembrado.');
  const order = await prisma!.order.create({
    data: {
      userId,
      packageId: pkg.id,
      packageKey: pkg.key,
      packageName: pkg.name,
      subtotalCents: pkg.priceCents,
      shippingCents: pkg.shippingCents,
      totalCents: pkg.priceCents + pkg.shippingCents,
      currency: pkg.currency,
      status: 'paid',
    },
  });
  const fulfillment = await prisma!.fulfillment.create({ data: { orderId: order.id } });
  return { order, fulfillment };
}

run('scoring de candidatos y selección trazable', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma?.$disconnect();
  });

  it('persiste recomendación y candidatos; repuntuar crea una revisión inmutable', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const { userId } = await makeReadyReader();
    const { fulfillment } = await makeOrderFulfillment(userId);

    const first = await scoringService!.scoreForFulfillment(fulfillment.id);
    expect(first.recommendation.revision).toBe(1);
    expect(first.candidates.length).toBeGreaterThan(0);
    const candidate = first.candidates[0]!;
    expect(candidate.reviewStatus).toBe('eligible');
    expect(candidate.numericFitScore).not.toBeNull();
    expect(candidate.finalScore).not.toBeNull();
    expect(candidate.bookEditionId).toBe(edition.id);
    expect(candidate.classificationVersionId).toBe(classification.id);
    expect(candidate.explanation.reasons.length).toBeGreaterThan(0);

    const second = await scoringService!.scoreForFulfillment(fulfillment.id);
    expect(second.recommendation.revision).toBe(2);
    const current = await prisma!.recommendation.findFirst({ where: { fulfillmentId: fulfillment.id, isCurrent: true } });
    expect(current?.revision).toBe(2);
    const previous = await prisma!.recommendation.findFirst({ where: { fulfillmentId: fulfillment.id, revision: 1 } });
    expect(previous?.isCurrent).toBe(false);
    const previousCandidates = await prisma!.recommendationCandidate.count({ where: { recommendationId: previous!.id } });
    expect(previousCandidates).toBeGreaterThan(0);
  });

  it('asignar con candidateId liga la selección y escribe auditoría', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const { userId } = await makeReadyReader();
    const { fulfillment } = await makeOrderFulfillment(userId);
    const scored = await scoringService!.scoreForFulfillment(fulfillment.id);
    const candidate = scored.candidates[0]!;

    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, {
      bookEditionId: candidate.bookEditionId,
      classificationVersionId: candidate.classificationVersionId,
      candidateId: candidate.candidateId,
      reason: 'El mejor score',
    });

    const stored = await prisma!.curationAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(stored.recommendationCandidateId).toBe(candidate.candidateId);
    expect(stored.bookEditionId).toBe(edition.id);
    expect(stored.classificationVersionId).toBe(classification.id);
    const recommendation = await prisma!.recommendation.findUniqueOrThrow({ where: { id: scored.recommendation.id } });
    expect(recommendation.status).toBe('selected');
    const audit = await prisma!.curatorActionAudit.findFirst({ where: { targetId: assignment.id } });
    expect(audit?.actionKind).toBe('assign_book');
    expect(audit?.reason).toBe('El mejor score');
  });

  it('override sin candidateId añade un candidato al ranking actual', async () => {
    await makeApprovedEdition();
    const { userId } = await makeReadyReader();
    const { fulfillment } = await makeOrderFulfillment(userId);
    const scored = await scoringService!.scoreForFulfillment(fulfillment.id);

    const other = await makeApprovedEdition();
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, {
      bookEditionId: other.edition.id,
      classificationVersionId: other.classification.id,
      reason: 'Override del curador',
    });

    const stored = await prisma!.curationAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    const candidate = await prisma!.recommendationCandidate.findUniqueOrThrow({ where: { id: stored.recommendationCandidateId! } });
    expect(candidate.recommendationId).toBe(scored.recommendation.id);
    expect(candidate.rankPosition).toBeNull();
    expect(candidate.bookEditionId).toBe(other.edition.id);
  });

  it('candidato de otro fulfillment no puede asignarse', async () => {
    await makeApprovedEdition();
    const { userId } = await makeReadyReader();
    const { fulfillment: f1 } = await makeOrderFulfillment(userId);
    const { fulfillment: f2 } = await makeOrderFulfillment(userId);
    const scored = await scoringService!.scoreForFulfillment(f1.id);
    const candidate = scored.candidates[0]!;
    await expect(
      curationService!.assign('00000000-0000-0000-0000-0000000000aa', f2.id, {
        bookEditionId: candidate.bookEditionId,
        classificationVersionId: candidate.classificationVersionId,
        candidateId: candidate.candidateId,
      }),
    ).rejects.toThrow();
  });

  it('excluye de la puntuación los libros que el usuario ya leyó', async () => {
    const read = await makeApprovedEdition();
    const other = await makeApprovedEdition();
    const { userId } = await makeReadyReader();
    const { fulfillment } = await makeOrderFulfillment(userId);

    await prisma!.readingFeedback.create({
      data: {
        userId,
        bookId: read.book.id,
        bookEditionId: read.edition.id,
        bookClassificationVersionId: read.classification.id,
        feedbackVersion: 'feedback/1.0',
        started: true,
        readingStatus: 'completed',
        completionPercentage: 100,
        selectionFitRating: 4,
        isFinal: true,
        learningStatus: 'processed',
      },
    });

    const scored = await scoringService!.scoreForFulfillment(fulfillment.id);
    expect(scored.candidates.some((candidate) => candidate.bookEditionId === read.edition.id)).toBe(false);
    expect(scored.candidates.some((candidate) => candidate.bookEditionId === other.edition.id)).toBe(true);
  });

  it('excluye de la puntuación los títulos guardados en la estantería', async () => {
    const saved = await makeApprovedEdition();
    const other = await makeApprovedEdition();
    const { userId } = await makeReadyReader();
    const { fulfillment } = await makeOrderFulfillment(userId);

    await profileService!.addSupplementalBooks(userId, [{
      category: 'enjoyed',
      openLibraryId: 'OL1W',
      openLibraryEditionId: null,
      coverId: null,
      title: saved.book.canonicalTitle,
      authors: [],
      coverUrl: null,
      rating: 5,
      likedAspects: ['characters'],
      reasonCodes: [],
      freeText: null,
    }]);

    const scored = await scoringService!.scoreForFulfillment(fulfillment.id);
    expect(scored.candidates.some((candidate) => candidate.bookEditionId === saved.edition.id)).toBe(false);
    expect(scored.candidates.some((candidate) => candidate.bookEditionId === other.edition.id)).toBe(true);
  });
});
