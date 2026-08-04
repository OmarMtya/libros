import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BooksService } from '../src/books/books.service';
import { CatalogService } from '../src/books/catalog.service';
import { CurationService } from '../src/curation/curation.service';
import { CuratorAuditService } from '../src/curation/curator-audit.service';
import { EmailService } from '../src/email/email.service';
import { FeedbackContextResolver } from '../src/feedback/feedback-context.resolver';
import { FeedbackInvitationService } from '../src/feedback/feedback-invitation.service';
import { FeedbackLearningService } from '../src/feedback/feedback-learning.service';
import { FeedbackTokenService } from '../src/feedback/feedback-token.service';
import { SubmitFeedbackByTokenDto } from '../src/feedback/feedback.dto';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
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
const learningService = prisma ? new FeedbackLearningService(prisma as never, profileService!, new EvidenceFactory(), { triggerGeneration: async () => undefined, hasActiveFeedbackCycles: async () => false, generateNow: async () => undefined } as never) : null;
const tokenService = prisma
  ? new FeedbackTokenService(
      prisma as never,
      new FeedbackInvitationService(),
      new FeedbackContextResolver(),
      learningService!,
      { notifyNewReader: async () => undefined, notifyNewFeedback: async () => undefined } as never,
    )
  : null;

const REQUIRED_FICTION_FEATURES = [
  'hook_speed', 'narrative_pace', 'slow_burn_level', 'narrative_payoff', 'style_clarity',
  'ornate_prose', 'linguistic_complexity', 'structural_complexity', 'conceptual_density',
  'character_depth', 'character_agency', 'character_likability', 'relationship_focus',
  'cast_size_load', 'multi_pov_load', 'introspection_density', 'repetition_level',
  'tension_level', 'descriptive_density', 'worldbuilding_load', 'ending_openness',
];

let sequence = 0;
let isbnSequence = 0;
const nextKey = () => `rt-key-${++sequence}`;
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
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
}

async function makeApprovedEdition() {
  const actor = '00000000-0000-0000-0000-0000000000aa';
  const book = await catalogService!.createBook(actor, { canonicalTitle: `Traza ${++sequence}`, originalLanguage: 'es' });
  const edition = await catalogService!.addEdition(book.id, {
    title: 'Traza (ed. es)',
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

function feedbackPayload(overrides: Partial<SubmitFeedbackByTokenDto>): SubmitFeedbackByTokenDto {
  return {
    started: true,
    readingStatus: 'completed',
    completionPercentage: 100,
    positiveAspects: ['tension_curiosity'],
    negativeAspects: [],
    outcomeAttribution: 'mostly_book',
    idempotencyKey: nextKey(),
    ...overrides,
  } as SubmitFeedbackByTokenDto;
}

async function submitFeedback(plainToken: string, userId: string) {
  const result = await tokenService!.submitByToken(plainToken, feedbackPayload({}), userId);
  expect(result.learningStatus).toBe('processed');
  return result;
}

run('trazabilidad ReadingFeedback → Recommendation', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma?.$disconnect();
  });

  it('submitByToken guarda recommendationId desde el candidato seleccionado', async () => {
    const { edition } = await makeApprovedEdition();
    const { userId } = await makeReadyReader();
    const { fulfillment } = await makeOrderFulfillment(userId);
    const scored = await scoringService!.scoreForFulfillment(fulfillment.id);
    const candidate = scored.candidates[0]!;
    expect(candidate.bookEditionId).toBe(edition.id);

    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, {
      bookEditionId: candidate.bookEditionId,
      classificationVersionId: candidate.classificationVersionId,
      candidateId: candidate.candidateId,
    });
    expect(assignment.recommendationCandidateId).toBe(candidate.candidateId);

    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const result = await submitFeedback(plainToken, userId);
    expect(result.feedback.recommendationId).toBe(scored.recommendation.id);
    const stored = await prisma!.readingFeedback.findUniqueOrThrow({ where: { id: result.feedback.id } });
    expect(stored.recommendationId).toBe(scored.recommendation.id);
  });

  it('guarda la recomendación histórica de la asignación aunque exista una revisión current posterior', async () => {
    const { edition } = await makeApprovedEdition();
    const { userId } = await makeReadyReader();
    const { fulfillment } = await makeOrderFulfillment(userId);

    const first = await scoringService!.scoreForFulfillment(fulfillment.id);
    const candidate = first.candidates[0]!;
    expect(candidate.bookEditionId).toBe(edition.id);

    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, {
      bookEditionId: candidate.bookEditionId,
      classificationVersionId: candidate.classificationVersionId,
      candidateId: candidate.candidateId,
    });
    expect(assignment.recommendationCandidateId).toBe(candidate.candidateId);

    await scoringService!.scoreForFulfillment(fulfillment.id);
    await scoringService!.scoreForFulfillment(fulfillment.id);
    const current = await prisma!.recommendation.findFirstOrThrow({ where: { fulfillmentId: fulfillment.id, isCurrent: true } });
    expect(current.id).not.toBe(first.recommendation.id);

    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const result = await submitFeedback(plainToken, userId);
    expect(result.feedback.recommendationId).toBe(first.recommendation.id);
    expect(result.feedback.recommendationId).not.toBe(current.id);
  });

  it('un override manual también conserva recommendationId', async () => {
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

    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const result = await submitFeedback(plainToken, userId);
    expect(result.feedback.recommendationId).toBe(scored.recommendation.id);
  });

  it('una asignación legacy sin candidato deja recommendationId null', async () => {
    const { edition } = await makeApprovedEdition();
    const userId = randomUUID();
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: (await prisma!.bookClassificationVersion.findFirstOrThrow({ where: { bookEditionId: edition.id, status: 'approved' } })).id });
    expect(assignment.recommendationCandidateId).toBeNull();

    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const result = await submitFeedback(plainToken, userId);
    expect(result.feedback.recommendationId).toBeNull();
  });
});
