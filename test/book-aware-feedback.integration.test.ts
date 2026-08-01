import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CatalogService } from '../src/books/catalog.service';
import { BooksService } from '../src/books/books.service';
import { CurationService } from '../src/curation/curation.service';
import { CuratorAuditService } from '../src/curation/curator-audit.service';
import { FeedbackContextResolver } from '../src/feedback/feedback-context.resolver';
import { FeedbackInvitationService } from '../src/feedback/feedback-invitation.service';
import { FeedbackLearningService } from '../src/feedback/feedback-learning.service';
import { FeedbackTokenService } from '../src/feedback/feedback-token.service';
import { SubmitFeedbackByTokenDto } from '../src/feedback/feedback.dto';
import { ProfileService } from '../src/profile/profile.service';
import { EvidenceFactory } from '../src/profile/evidence.factory';
import { BOOK_FEATURE_SCHEMA_VERSION } from '../src/catalog/book-feature-definitions';
import { CONTENT_TYPE_SCHEMA_VERSION } from '../src/catalog/content-type-definitions';
import { TAG_TAXONOMY_VERSION } from '../src/profile/catalog';
import { assertTestDatabase } from './helpers/test-database';

const url = process.env.TEST_DATABASE_URL;
const run = describe.runIf(Boolean(url));
assertTestDatabase(url);

const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const invitationService = new FeedbackInvitationService();
const catalogService = prisma ? new CatalogService(prisma as never, new BooksService()) : null;
const curationService = prisma ? new CurationService(prisma as never, invitationService, new CuratorAuditService(prisma as never)) : null;
const learningService = prisma ? new FeedbackLearningService(prisma as never, new ProfileService(prisma as never), new EvidenceFactory()) : null;
const tokenService = prisma ? new FeedbackTokenService(prisma as never, invitationService, new FeedbackContextResolver(), learningService!) : null;

const REQUIRED_FICTION_FEATURES = [
  'hook_speed', 'narrative_pace', 'slow_burn_level', 'narrative_payoff', 'style_clarity',
  'ornate_prose', 'linguistic_complexity', 'structural_complexity', 'conceptual_density',
  'character_depth', 'character_agency', 'character_likability', 'relationship_focus',
  'cast_size_load', 'multi_pov_load', 'introspection_density', 'repetition_level',
  'tension_level', 'descriptive_density', 'worldbuilding_load', 'ending_openness',
];

let sequence = 0;
let isbnSequence = 0;
const nextKey = () => `it-key-${++sequence}`;
const nextIsbn = () => `9780${String(++isbnSequence).padStart(9, '0')}`;

async function cleanDatabase() {
  if (!prisma) return;
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
  const catalog = catalogService!;
  const actor = '00000000-0000-0000-0000-0000000000aa';
  const book = await catalog.createBook(actor, {
    canonicalTitle: 'Eligh',
    originalLanguage: 'es',
    authors: [
      { name: 'Autora A', role: 'author', position: 0 },
      { name: 'Autor B', role: 'author', position: 1 },
    ],
  });
  const edition = await catalog.addEdition(book.id, {
    title: 'Eligh (ed. es)',
    isbn: nextIsbn(),
    languageCode: 'es',
    pages: 248,
    publisher: 'Editorial',
    publicationYear: 2023,
    contributors: [{ authorName: 'Traductor T', role: 'translator', position: 0 }],
  });
  const classification = await catalog.createClassification(actor, edition.id, {
    contentTypeKey: 'fiction',
    contentTypeSchemaVersion: CONTENT_TYPE_SCHEMA_VERSION,
    featureSchemaVersion: BOOK_FEATURE_SCHEMA_VERSION,
    tagTaxonomyVersion: TAG_TAXONOMY_VERSION,
    features: REQUIRED_FICTION_FEATURES.map((featureKey) => ({ featureKey, value: 0.7, confidence: 0.6 })),
    tags: [
      { tagKey: 'science_fiction', strength: 0.9, confidence: 0.7 },
      { tagKey: 'identity', strength: 0.6, confidence: 0.6 },
      { tagKey: 'space_opera', strength: 0.5, confidence: 0.5 },
    ],
  });
  const approved = await catalog.approve(actor, classification.id);
  return { book, edition, classification: approved };
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
    positiveAspects: [],
    negativeAspects: ['style_too_simple'],
    outcomeAttribution: 'mostly_book',
    idempotencyKey: nextKey(),
    ...overrides,
  } as SubmitFeedbackByTokenDto;
}

run('cadena envío -> invitación -> feedback', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma?.$disconnect();
  });

  it('crea libro, edición con traductor, clasifica y aprueba', async () => {
    const { book, edition, classification } = await makeApprovedEdition();
    const fresh = await catalogService!.getBook(book.id);
    expect(fresh.authors.length).toBe(2);
    const authors = fresh.authors.map((a) => a.author.canonicalName).sort();
    expect(authors).toEqual(['Autor B', 'Autora A']);
    const contributors = fresh.editions.flatMap((ed) => ed.contributors.map((c) => c.author.canonicalName));
    expect(contributors).toEqual(['Traductor T']);
    expect(edition.isbn).toMatch(/^\d{13}$/);
    expect(classification.status).toBe('approved');
    expect(classification.revision).toBe(1);
  });

  it('asignación -> pack -> ship genera invitación; GET resuelve el libro correcto', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '11111111-1111-1111-1111-111111111111';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, {
      bookEditionId: edition.id,
      classificationVersionId: classification.id,
    });
    expect(assignment.status).toBe('active');
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.status).toBe('assigned');

    await curationService!.pack(assignment.id);
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.status).toBe('packed');

    const shipped = await curationService!.ship(assignment.id);
    expect(shipped.plainToken.length).toBeGreaterThan(30);
    expect(shipped.url).toContain('/feedback/');
    const storedInvitation = await prisma!.feedbackInvitation.findFirst({ where: { curationAssignmentId: assignment.id } });
    expect(storedInvitation?.tokenHash).not.toBe(shipped.plainToken);

    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);
    const resolved = await tokenService!.resolveInvitation(shipped.plainToken);
    expect(resolved.received).toBe(false);
    expect(resolved.book.title).toBe('Eligh');
    expect(resolved.book.authors).toContain('Autora A');
    expect(resolved.book.contributors).toEqual(['Traductor T']);
  });

  it('la invitación es válida desde shipped (sin esperar delivered); GET resuelve el libro', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '22222222-2222-2222-2222-222222222222';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const shipped = await curationService!.ship(assignment.id);
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.status).toBe('shipped');

    const resolved = await tokenService!.resolveInvitation(shipped.plainToken);
    expect(resolved.received).toBe(false);
    expect(resolved.book.title).toBe('Eligh');
  });

  it('invitación válida también en in_delivery', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '22222222-2222-2222-2222-222222222223';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const shipped = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);

    const resolved = await tokenService!.resolveInvitation(shipped.plainToken);
    expect(resolved.received).toBe(false);
    expect(resolved.book.title).toBe('Eligh');
  });

  it('feedback con logística en shipped marca el envío como entregado (edge case)', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '22222222-2222-2222-2222-222222222224';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);

    const result = await tokenService!.submitByToken(plainToken, feedbackPayload({ idempotencyKey: nextKey() }), userId);
    expect(result.feedback.id).toBeTruthy();
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.status).toBe('delivered');
    const cycle = await prisma!.curationAssignment.findUnique({ where: { id: assignment.id } });
    expect(cycle?.feedbackCycleStatus).toBe('final_received');
  });

  it('no se puede asignar ni enviar sin clasificación aprobada; no se puede reemplazar después de shipped', async () => {
    const catalog = catalogService!;
    const actor = '00000000-0000-0000-0000-0000000000aa';
    const book = await catalog.createBook(actor, { canonicalTitle: 'Sin aprobar', originalLanguage: 'es' });
    const edition = await catalog.addEdition(book.id, { title: 'SA', languageCode: 'es', pages: 100 });
    const draft = await catalog.createClassification(actor, edition.id, {
      contentTypeKey: 'fiction',
      contentTypeSchemaVersion: CONTENT_TYPE_SCHEMA_VERSION,
      featureSchemaVersion: BOOK_FEATURE_SCHEMA_VERSION,
      tagTaxonomyVersion: TAG_TAXONOMY_VERSION,
      features: REQUIRED_FICTION_FEATURES.map((featureKey) => ({ featureKey, value: 0.5, confidence: 0.5 })),
      tags: [{ tagKey: 'science_fiction', strength: 0.8, confidence: 0.6 }, { tagKey: 'identity', strength: 0.6, confidence: 0.5 }],
    });

    const userId = randomUUID();
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    await expect(curationService!.assign(actor, fulfillment.id, { bookEditionId: edition.id, classificationVersionId: draft.id })).rejects.toThrow();

    const { edition: approvedEdition, classification: approved } = await makeApprovedEdition();
    const approvedAssignment = await curationService!.assign(actor, fulfillment.id, { bookEditionId: approvedEdition.id, classificationVersionId: approved.id });
    await curationService!.pack(approvedAssignment.id);
    await prisma!.bookClassificationVersion.update({ where: { id: approved.id }, data: { status: 'draft' } });
    await expect(curationService!.ship(approvedAssignment.id)).rejects.toThrow();
  });

  it('clasificación de otra edición no puede asignarse', async () => {
    const catalog = catalogService!;
    const actor = '00000000-0000-0000-0000-0000000000aa';
    const { edition: e1 } = await makeApprovedEdition();
    const book2 = await catalog.createBook(actor, { canonicalTitle: 'Otra obra', originalLanguage: 'es' });
    const e2 = await catalog.addEdition(book2.id, { title: 'O2', languageCode: 'es', pages: 90 });

    const userId = '33333333-3333-3333-3333-333333333333';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const classificationOfE1 = await prisma!.bookClassificationVersion.findFirstOrThrow({ where: { bookEditionId: e1.id, status: 'approved' } });
    await expect(curationService!.assign(actor, fulfillment.id, { bookEditionId: e2.id, classificationVersionId: classificationOfE1.id })).rejects.toThrow();
  });

  it('feedback de prosa demasiado simple → processed, ids congelados, evidencia derivada del libro', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '44444444-4444-4444-4444-444444444444';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const dto = feedbackPayload({ readingStatus: 'completed', completionPercentage: 100, negativeAspects: ['style_too_simple'], idempotencyKey: nextKey() });
    const result = await tokenService!.submitByToken(plainToken, dto, userId);
    expect(result.learningStatus).toBe('processed');
    const feedback = result.feedback;
    expect(feedback.bookId).toBe(edition.bookId);
    expect(feedback.bookEditionId).toBe(edition.id);
    expect(feedback.bookClassificationVersionId).toBe(classification.id);
    expect(feedback.curationAssignmentId).toBe(assignment.id);
    expect(feedback.feedbackInvitationId).not.toBeNull();
    expect(feedback.isFinal).toBe(true);
    expect(feedback.processingOutcome).toBe('learned');

    const evidence = await prisma!.readerEvidence.findMany({ where: { sourceId: feedback.id } });
    expect(evidence.length).toBe(2);
    expect(evidence.map((item) => item.dimensionKey).sort()).toEqual(['linguistic_complexity_tolerance', 'ornate_prose_tolerance']);
    for (const item of evidence) {
      expect(Number(item.observedValue)).toBeCloseTo(0.85, 4);
      expect(Number(item.finalWeight)).toBeCloseTo(1.2, 4);
      expect(item.bookId).toBe(edition.bookId);
    }

    const profile = await prisma!.readerProfile.findUniqueOrThrow({ where: { userId } });
    expect(profile.currentVersion).toBeGreaterThan(0);
    const versions = await prisma!.readerProfileVersion.findMany({ where: { profileId: profile.id } });
    expect(versions.length).toBeGreaterThan(0);

    const cycle = await prisma!.curationAssignment.findUnique({ where: { id: assignment.id } });
    expect(cycle?.feedbackCycleStatus).toBe('final_received');
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.status).toBe('delivered');
  });

  it('tension_curiosity se procesa con un libro que tiene tension_level pero no strangeness_level', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const features = await prisma!.bookFeature.findMany({ where: { classificationVersionId: classification.id }, select: { featureKey: true } });
    expect(features.map((feature) => feature.featureKey)).toContain('tension_level');
    expect(features.map((feature) => feature.featureKey)).not.toContain('strangeness_level');

    const userId = '11112222-2222-3333-4444-555566667777';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const result = await tokenService!.submitByToken(plainToken, feedbackPayload({ positiveAspects: ['tension_curiosity'], negativeAspects: [], idempotencyKey: nextKey() }), userId);
    expect(result.learningStatus).toBe('processed');
    expect(result.feedback.processingOutcome).toBe('learned');
    const evidence = await prisma!.readerEvidence.findMany({ where: { sourceId: result.feedback.id } });
    expect(evidence.map((item) => item.dimensionKey)).toEqual(['tension_preference']);
    expect(evidence[0]!.reasonCode).toBe('f05_tension_learn');
    expect(evidence[0]!.dimensionKey).not.toBe('strangeness_preference');
  });

  it('un feedback iniciado con notStartedReason es rechazado', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '22223333-3333-4444-5555-666677778888';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    await expect(tokenService!.submitByToken(plainToken, feedbackPayload({ started: true, notStartedReason: 'no_time', idempotencyKey: nextKey() }), userId)).rejects.toThrow();
  });

  it('selectionFitRating se persiste mediante el flujo existente', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '33334444-4444-5555-6666-777788889999';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const result = await tokenService!.submitByToken(plainToken, feedbackPayload({ selectionFitRating: 5, idempotencyKey: nextKey() }), userId);
    expect(result.feedback.selectionFitRating).toBe(5);
    const stored = await prisma!.readingFeedback.findUniqueOrThrow({ where: { id: result.feedback.id } });
    expect(stored.selectionFitRating).toBe(5);
  });

  it('una invitación crea un solo feedback; mismo key → existente; otro key → 409', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '55555555-5555-5555-5555-555555555555';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const key = nextKey();
    const dto = feedbackPayload({ idempotencyKey: key });
    const first = await tokenService!.submitByToken(plainToken, dto, null);
    const retry = await tokenService!.submitByToken(plainToken, dto, null);
    expect(retry.feedback.id).toBe(first.feedback.id);
    await expect(tokenService!.submitByToken(plainToken, feedbackPayload({ idempotencyKey: nextKey() }), null)).rejects.toThrow();
    const count = await prisma!.readingFeedback.count({ where: { feedbackInvitationId: first.feedback.feedbackInvitationId } });
    expect(count).toBe(1);
  });

  it('provisional consume su invitación; reissue (escenario B) permite el final', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '66666666-6666-6666-6666-666666666666';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const provisional = await tokenService!.submitByToken(plainToken, feedbackPayload({ readingStatus: 'in_progress', completionPercentage: 38, idempotencyKey: nextKey() }), null);
    expect(provisional.feedback.isFinal).toBe(false);
    let cycle = await prisma!.curationAssignment.findUnique({ where: { id: assignment.id } });
    expect(cycle?.feedbackCycleStatus).toBe('provisional_received');

    await expect(tokenService!.submitByToken(plainToken, feedbackPayload({ idempotencyKey: nextKey() }), null)).rejects.toThrow();

    const reissued = await curationService!.reissueInvitation(assignment.id);
    expect(reissued.feedbackCycleStatus).toBe('provisional_received');
    const final = await tokenService!.submitByToken(reissued.plainToken, feedbackPayload({ idempotencyKey: nextKey() }), null);
    expect(final.feedback.isFinal).toBe(true);
    cycle = await prisma!.curationAssignment.findUnique({ where: { id: assignment.id } });
    expect(cycle?.feedbackCycleStatus).toBe('final_received');
    const count = await prisma!.readingFeedback.count({ where: { curationAssignmentId: assignment.id } });
    expect(count).toBe(2);
  });

  it('fetch de invitación pendiente devuelve el mismo URL sin invalidar ni crear una nueva', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '77777777-7777-7777-7777-777777777777';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const shipped = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const fetched = await curationService!.reissueInvitation(assignment.id);
    expect(fetched.plainToken).toBe(shipped.plainToken);
    expect(fetched.url).toBe(shipped.url);

    const invitations = await prisma!.feedbackInvitation.findMany({ where: { curationAssignmentId: assignment.id } });
    expect(invitations.length).toBe(1);
    const invitation = invitations[0]!;
    expect(invitation.status).toBe('pending');
    expect(invitation.tokenHash).toBe(invitationService.hashToken(fetched.plainToken));

    await expect(tokenService!.resolveInvitation(fetched.plainToken)).resolves.toMatchObject({ received: false });
  });

  it('undo logístico recorre hacia atrás delivered → in_delivery → shipped → packed → assigned', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '88888888-8888-8888-8888-888888888888';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    await curationService!.undoDelivered(assignment.id);
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.status).toBe('in_delivery');
    await curationService!.undoInDelivery(assignment.id);
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.status).toBe('shipped');
    await curationService!.unship(assignment.id);
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.status).toBe('packed');
    await curationService!.unpack(assignment.id);
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.status).toBe('assigned');
  });

  it('unship revoca la invitación pendiente y resetea el ciclo de feedback', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '99999998-9998-9998-9998-999899989998';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    await curationService!.ship(assignment.id);
    const invitation = await prisma!.feedbackInvitation.findFirst({ where: { curationAssignmentId: assignment.id } });
    expect(invitation?.status).toBe('pending');

    await curationService!.unship(assignment.id);
    const cycle = await prisma!.curationAssignment.findUnique({ where: { id: assignment.id } });
    expect(cycle?.feedbackCycleStatus).toBe('not_invited');
    const revoked = await prisma!.feedbackInvitation.findUnique({ where: { id: invitation!.id } });
    expect(revoked?.status).toBe('revoked');
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.shippedAt).toBeNull();
  });

  it('undo falla en estados no permitidos', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '99999997-9997-9997-9997-999799979997';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });

    await expect(curationService!.unpack(assignment.id)).rejects.toThrow();
    await expect(curationService!.unship(assignment.id)).rejects.toThrow();
    await expect(curationService!.undoDelivered(assignment.id)).rejects.toThrow();

    await curationService!.pack(assignment.id);
    await expect(curationService!.undoDelivered(assignment.id)).rejects.toThrow();
  });

  it('feedback ambiguo → needs_clarification; sin iniciar → processed/commercial_only; topic_no_interest → needs_review', async () => {
    const runFor = async (dto: SubmitFeedbackByTokenDto) => {
      const { edition, classification } = await makeApprovedEdition();
      const userId = randomUUID();
      await prisma!.user.create({ data: { id: userId } });
      const { fulfillment } = await makeOrderFulfillment(userId);
      const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
      await curationService!.pack(assignment.id);
      const { plainToken } = await curationService!.ship(assignment.id);
      await curationService!.startDelivery(assignment.id);
      await curationService!.delivered(assignment.id);
      return tokenService!.submitByToken(plainToken, dto, null);
    };

    const ambiguous = await runFor(feedbackPayload({ positiveAspects: [], negativeAspects: [], idempotencyKey: nextKey() }));
    expect(ambiguous.learningStatus).toBe('needs_clarification');

    const notStarted = await runFor(feedbackPayload({
      started: false,
      readingStatus: 'not_started',
      completionPercentage: 0,
      notStartedReason: 'no_time',
      positiveAspects: [],
      negativeAspects: [],
      idempotencyKey: nextKey(),
    }));
    expect(notStarted.learningStatus).toBe('processed');
    expect(notStarted.feedback.processingOutcome).toBe('commercial_only');

    const topic = await runFor(feedbackPayload({ negativeAspects: ['topic_no_interest'], idempotencyKey: nextKey() }));
    expect(topic.learningStatus).toBe('needs_review');
  });

  it('atmosphere sigue siendo válido: se guarda como aspecto, no genera evidencia ni toca descriptive_density_preference', async () => {
    const { edition } = await makeApprovedEdition();
    const userId = 'cccc1111-2222-3333-4444-555566667777';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: (await prisma!.bookClassificationVersion.findFirstOrThrow({ where: { bookEditionId: edition.id, status: 'approved' } })).id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const result = await tokenService!.submitByToken(plainToken, feedbackPayload({ positiveAspects: ['atmosphere'], negativeAspects: [], idempotencyKey: nextKey() }), userId);
    expect(result.learningStatus).toBe('processed');
    expect(result.feedback.processingOutcome).toBe('learned_without_evidence');

    const aspects = await prisma!.readingFeedbackAspect.findMany({ where: { feedbackId: result.feedback.id } });
    expect(aspects).toEqual([expect.objectContaining({ polarity: 'positive', optionKey: 'atmosphere' })]);

    const evidence = await prisma!.readerEvidence.findMany({ where: { sourceId: result.feedback.id } });
    expect(evidence).toEqual([]);

    const profile = await prisma!.readerProfile.findUniqueOrThrow({ where: { userId } });
    const descriptiveDensity = await prisma!.readerProfileDimension.findUniqueOrThrow({
      where: { profileId_dimensionKey: { profileId: profile.id, dimensionKey: 'descriptive_density_preference' } },
    });
    expect(descriptiveDensity.value).toBeNull();
    expect(descriptiveDensity.evidenceCount).toBe(0);
  });

  it('combinar atmosphere con tension_curiosity solo genera evidencia de tensión', async () => {
    const { edition } = await makeApprovedEdition();
    const userId = 'dddd2222-3333-4444-5555-666677778888';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: (await prisma!.bookClassificationVersion.findFirstOrThrow({ where: { bookEditionId: edition.id, status: 'approved' } })).id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    const result = await tokenService!.submitByToken(plainToken, feedbackPayload({ positiveAspects: ['atmosphere', 'tension_curiosity'], negativeAspects: [], idempotencyKey: nextKey() }), userId);
    expect(result.learningStatus).toBe('processed');
    expect(result.feedback.processingOutcome).toBe('learned');
    const evidence = await prisma!.readerEvidence.findMany({ where: { sourceId: result.feedback.id } });
    expect(evidence.map((item) => item.dimensionKey)).toEqual(['tension_preference']);
    expect(evidence.every((item) => item.reasonCode !== 'f05_atmosphere_learn')).toBe(true);
  });

  it('asignación legacy sin candidato ligado deja recommendationId null', async () => {
    const { edition } = await makeApprovedEdition();
    const userId = 'eeee3333-4444-5555-6666-777788889999';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: (await prisma!.bookClassificationVersion.findFirstOrThrow({ where: { bookEditionId: edition.id, status: 'approved' } })).id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);

    expect(assignment.recommendationCandidateId).toBeNull();
    const result = await tokenService!.submitByToken(plainToken, feedbackPayload({ positiveAspects: ['tension_curiosity'], negativeAspects: [], idempotencyKey: nextKey() }), userId);
    expect(result.feedback.recommendationId).toBeNull();
    const stored = await prisma!.readingFeedback.findUniqueOrThrow({ where: { id: result.feedback.id } });
    expect(stored.recommendationId).toBeNull();
  });

  it('close-without-feedback revoca la invitación y genera 0 evidencias; reissue bloqueado', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '99999999-9999-9999-9999-999999999999';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    await curationService!.ship(assignment.id);
    await curationService!.closeWithoutFeedback(assignment.id);
    const cycle = await prisma!.curationAssignment.findUnique({ where: { id: assignment.id } });
    expect(cycle?.feedbackCycleStatus).toBe('closed_without_feedback');
    const evidence = await prisma!.readerEvidence.findMany({ where: { bookId: edition.bookId } });
    expect(evidence.length).toBe(0);
    await expect(curationService!.reissueInvitation(assignment.id)).rejects.toThrow();
  });

  it('reabrir un ciclo cerrado sin feedback restaura la misma invitación (mismo URL)', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '99999996-9996-9996-9996-999699969996';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const shipped = await curationService!.ship(assignment.id);
    const invitationId = shipped.invitation.id;

    await curationService!.closeWithoutFeedback(assignment.id);
    const revoked = await prisma!.feedbackInvitation.findUnique({ where: { id: invitationId } });
    expect(revoked?.status).toBe('revoked');

    const reopened = await curationService!.reopenLearning('00000000-0000-0000-0000-0000000000aa', assignment.id, 'el lector sí quiere opinar');
    expect(reopened.url).toBe(shipped.url);
    expect(reopened.plainToken).toBe(shipped.plainToken);

    const restored = await prisma!.feedbackInvitation.findUnique({ where: { id: invitationId } });
    expect(restored?.status).toBe('pending');
    expect(restored?.revokedAt).toBeNull();
    const cycle = await prisma!.curationAssignment.findUnique({ where: { id: assignment.id } });
    expect(cycle?.feedbackCycleStatus).toBe('invited');
    expect(cycle?.notes).toContain('Reapertura por');
  });

  it('reabrir un ciclo con feedback final genera una invitación nueva', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = '99999995-9995-9995-9995-999599959995';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const shipped = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);
    await tokenService!.submitByToken(shipped.plainToken, feedbackPayload({ idempotencyKey: nextKey() }), null);
    const cycle = await prisma!.curationAssignment.findUnique({ where: { id: assignment.id } });
    expect(cycle?.feedbackCycleStatus).toBe('final_received');

    const reopened = await curationService!.reopenLearning('00000000-0000-0000-0000-0000000000aa', assignment.id, 'quiere corregir');
    expect(reopened.url).not.toBe(shipped.url);
    const pending = await prisma!.feedbackInvitation.findMany({ where: { curationAssignmentId: assignment.id, status: 'pending' } });
    expect(pending.length).toBe(1);
  });

  it('entregado sin feedback es logísticamente completo; delivered no depende del feedback', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);
    expect((await prisma!.fulfillment.findUnique({ where: { id: fulfillment.id } }))?.status).toBe('delivered');
    expect((await prisma!.curationAssignment.findUnique({ where: { id: assignment.id } }))?.feedbackCycleStatus).toBe('invited');
  });

  it('integridad en BD: snapshot de feedback inconsistente falla en persistencia', async () => {
    const { edition: e1, classification: c1 } = await makeApprovedEdition();
    const { edition: e2 } = await makeApprovedEdition();
    const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: e1.id, classificationVersionId: c1.id });

    await expect(
      prisma!.readingFeedback.create({
        data: {
          userId,
          orderId: fulfillment.orderId,
          curationAssignmentId: assignment.id,
          bookId: e2.bookId,
          bookEditionId: e2.id,
          bookClassificationVersionId: c1.id,
          feedbackVersion: 'feedback/1.0',
          started: true,
          readingStatus: 'completed',
          completionPercentage: 100,
          learningStatus: 'needs_review',
          isFinal: true,
        } as never,
      }),
    ).rejects.toThrow();
  });

  it('solo una clasificación approved por edición; aprobar la 2ª deja la 1ª superseded', async () => {
    const catalog = catalogService!;
    const actor = '00000000-0000-0000-0000-0000000000aa';
    const { edition } = await makeApprovedEdition();
    const second = await catalog.createClassification(actor, edition.id, {
      contentTypeKey: 'fiction',
      contentTypeSchemaVersion: CONTENT_TYPE_SCHEMA_VERSION,
      featureSchemaVersion: BOOK_FEATURE_SCHEMA_VERSION,
      tagTaxonomyVersion: TAG_TAXONOMY_VERSION,
      features: REQUIRED_FICTION_FEATURES.map((featureKey) => ({ featureKey, value: 0.8, confidence: 0.6 })),
      tags: [{ tagKey: 'science_fiction', strength: 0.9, confidence: 0.7 }, { tagKey: 'identity', strength: 0.6, confidence: 0.6 }, { tagKey: 'space_opera', strength: 0.8, confidence: 0.7 }],
    });
    expect(second.revision).toBe(2);
    const approved = await catalog.approve(actor, second.id);
    expect(approved.status).toBe('approved');
    const all = await prisma!.bookClassificationVersion.findMany({ where: { bookEditionId: edition.id }, orderBy: { revision: 'asc' } });
    expect(all.filter((row) => row.status === 'approved').length).toBe(1);
    expect(all.filter((row) => row.status === 'superseded').length).toBe(1);
  });

  it('invitación vencida aún pending no bloquea reissue (sin cron)', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await prisma!.feedbackInvitation.updateMany({ where: { curationAssignmentId: assignment.id, status: 'pending' }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    await expect(tokenService!.resolveInvitation(plainToken)).rejects.toThrow();
    const reissued = await curationService!.reissueInvitation(assignment.id);
    expect(reissued.plainToken).toBeTruthy();
    const pendings = await prisma!.feedbackInvitation.findMany({ where: { curationAssignmentId: assignment.id, status: 'pending' } });
    expect(pendings.length).toBe(1);
  });

  it('dos requests concurrentes no crean dos feedbacks para la misma invitación', async () => {
    const { edition, classification } = await makeApprovedEdition();
    const userId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    await prisma!.user.create({ data: { id: userId } });
    const { fulfillment } = await makeOrderFulfillment(userId);
    const assignment = await curationService!.assign('00000000-0000-0000-0000-0000000000aa', fulfillment.id, { bookEditionId: edition.id, classificationVersionId: classification.id });
    await curationService!.pack(assignment.id);
    const { plainToken } = await curationService!.ship(assignment.id);
    await curationService!.startDelivery(assignment.id);
    await curationService!.delivered(assignment.id);
    const results = await Promise.allSettled([
      tokenService!.submitByToken(plainToken, feedbackPayload({ idempotencyKey: nextKey() }), null),
      tokenService!.submitByToken(plainToken, feedbackPayload({ idempotencyKey: nextKey() }), null),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);
    const count = await prisma!.readingFeedback.count({ where: { feedbackInvitationId: (fulfilled[0] as { value: { feedback: { feedbackInvitationId: string } } }).value.feedback.feedbackInvitationId } });
    expect(count).toBe(1);
  });
});
