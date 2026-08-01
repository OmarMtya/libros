import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { CatalogService } from '../src/books/catalog.service';
import { BooksService } from '../src/books/books.service';
import { BOOK_FEATURE_SCHEMA_VERSION } from '../src/catalog/book-feature-definitions';
import { CONTENT_TYPE_SCHEMA_VERSION } from '../src/catalog/content-type-definitions';
import { TAG_TAXONOMY_VERSION } from '../src/profile/catalog';
import { assertTestDatabase } from './helpers/test-database';

const url = process.env.TEST_DATABASE_URL;
const run = describe.runIf(Boolean(url));
assertTestDatabase(url);

const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const catalog = prisma ? new CatalogService(prisma as never, new BooksService()) : null;

const ACTOR = '00000000-0000-0000-0000-0000000000bb';

const DRAFT_DTO = {
  contentTypeKey: 'fiction',
  contentTypeSchemaVersion: CONTENT_TYPE_SCHEMA_VERSION,
  featureSchemaVersion: BOOK_FEATURE_SCHEMA_VERSION,
  tagTaxonomyVersion: TAG_TAXONOMY_VERSION,
};

const REQUIRED_FICTION_FEATURES = [
  'hook_speed', 'narrative_pace', 'slow_burn_level', 'narrative_payoff', 'style_clarity',
  'ornate_prose', 'linguistic_complexity', 'structural_complexity', 'conceptual_density',
  'character_depth', 'character_agency', 'character_likability', 'relationship_focus',
  'cast_size_load', 'multi_pov_load', 'introspection_density', 'repetition_level',
  'tension_level', 'descriptive_density', 'worldbuilding_load', 'ending_openness',
];

const fictionFeatures = () => REQUIRED_FICTION_FEATURES.map((featureKey) => ({ featureKey, value: 0.7, confidence: 0.6 }));
const goodTags = () => [
  { tagKey: 'science_fiction', strength: 0.9, confidence: 0.7 },
  { tagKey: 'identity', strength: 0.6, confidence: 0.6 },
  { tagKey: 'space_opera', strength: 0.8, confidence: 0.7 },
];

let sequence = 0;
let isbnSequence = 0;
const nextIsbn = () => `9781${String(++isbnSequence).padStart(9, '0')}`;

async function cleanDatabase() {
  if (!prisma) return;
  await prisma.curatorActionAudit.deleteMany();
  await prisma.recommendationCandidate.deleteMany();
  await prisma.recommendation.deleteMany();
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
}

async function makeEdition() {
  const book = await catalog!.createBook(ACTOR, { canonicalTitle: `Manual ${++sequence}`, originalLanguage: 'es' });
  const edition = await catalog!.addEdition(book.id, {
    title: `Manual (ed. es) ${sequence}`,
    isbn: nextIsbn(),
    languageCode: 'es',
    pages: 200,
    publisher: 'Editorial',
    publicationYear: 2024,
  });
  return { book, edition };
}

async function makeApprovedFiction() {
  const { edition } = await makeEdition();
  const draft = await catalog!.getOrCreateDraft(ACTOR, edition.id, DRAFT_DTO);
  await catalog!.saveDraft(ACTOR, draft.id, {
    ...DRAFT_DTO,
    features: fictionFeatures(),
    tags: goodTags(),
  });
  const approved = await catalog!.approve(ACTOR, draft.id);
  return { edition, approved };
}

run('editor manual de clasificaciones', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma?.$disconnect();
  });

  it('no crea 21 features con 0.7: el borrador manual inicia con campos vacíos', async () => {
    const { edition } = await makeEdition();
    const draft = await catalog!.getOrCreateDraft(ACTOR, edition.id, DRAFT_DTO);
    expect(draft.status).toBe('draft');
    expect(draft.features.length).toBeGreaterThan(0);
    expect(draft.features.every((feature) => feature.value === null && feature.confidence === null && feature.notes === null)).toBe(true);
    expect(draft.features.filter((feature) => feature.value !== null)).toHaveLength(0);
    expect(draft.features.every((feature) => feature.label.length > 0 && feature.description.length > 0)).toBe(true);
    expect(draft.tags).toHaveLength(0);
  });

  it('crear o abrir un borrador: la segunda llamada devuelve el mismo draft', async () => {
    const { edition } = await makeEdition();
    const first = await catalog!.getOrCreateDraft(ACTOR, edition.id, DRAFT_DTO);
    const second = await catalog!.getOrCreateDraft(ACTOR, edition.id, DRAFT_DTO);
    expect(second.id).toBe(first.id);
    expect(second.revision).toBe(first.revision);
  });

  it('las obligatorias faltantes impiden aprobar', async () => {
    const { edition } = await makeEdition();
    const draft = await catalog!.getOrCreateDraft(ACTOR, edition.id, DRAFT_DTO);
    const result = await catalog!.saveDraft(ACTOR, draft.id, {
      ...DRAFT_DTO,
      features: [{ featureKey: 'hook_speed', value: 0.8, confidence: 0.6 }],
      tags: goodTags(),
    });
    expect(result.diagnostics.passes).toBe(false);
    expect(result.diagnostics.missingRequired.length).toBeGreaterThan(0);
    await expect(catalog!.approve(ACTOR, draft.id)).rejects.toThrow();
  });

  it('las opcionales pueden permanecer vacías y aun así aprobar', async () => {
    const { edition } = await makeEdition();
    const draft = await catalog!.getOrCreateDraft(ACTOR, edition.id, DRAFT_DTO);
    const requiredOnly = REQUIRED_FICTION_FEATURES.map((featureKey) => ({ featureKey, value: 0.7, confidence: 0.6 }));
    const result = await catalog!.saveDraft(ACTOR, draft.id, {
      ...DRAFT_DTO,
      features: requiredOnly,
      tags: goodTags(),
    });
    expect(result.diagnostics.passes).toBe(true);
    expect(result.diagnostics.optionalMissing.length).toBeGreaterThan(0);
    const approved = await catalog!.approve(ACTOR, draft.id);
    expect(approved.status).toBe('approved');
  });

  it('las features no aplicables no pueden guardarse', async () => {
    const { edition } = await makeEdition();
    const draft = await catalog!.getOrCreateDraft(ACTOR, edition.id, {
      ...DRAFT_DTO,
      contentTypeKey: 'expository_nonfiction',
    });
    await expect(
      catalog!.saveDraft(ACTOR, draft.id, {
        ...DRAFT_DTO,
        contentTypeKey: 'expository_nonfiction',
        features: [{ featureKey: 'character_depth', value: 0.5, confidence: 0.5 }],
        tags: [],
      }),
    ).rejects.toThrow(/no aplica/);
  });

  it('los tags solo pueden seleccionarse desde la taxonomía', async () => {
    const { edition } = await makeEdition();
    const draft = await catalog!.getOrCreateDraft(ACTOR, edition.id, DRAFT_DTO);
    await expect(
      catalog!.saveDraft(ACTOR, draft.id, {
        ...DRAFT_DTO,
        features: [],
        tags: [{ tagKey: 'tag_que_no_existe', strength: 0.5, confidence: 0.5 }],
      }),
    ).rejects.toThrow(/desconocido/);
    expect(draft.tagsAvailable.length).toBeGreaterThan(0);
  });

  it('el diagnóstico se actualiza al guardar cambios', async () => {
    const { edition } = await makeEdition();
    const draft = await catalog!.getOrCreateDraft(ACTOR, edition.id, DRAFT_DTO);
    const incomplete = await catalog!.saveDraft(ACTOR, draft.id, { ...DRAFT_DTO, features: [], tags: goodTags() });
    expect(incomplete.diagnostics.passes).toBe(false);
    expect(incomplete.diagnostics.missingRequired.length).toBe(REQUIRED_FICTION_FEATURES.length);

    const complete = await catalog!.saveDraft(ACTOR, draft.id, { ...DRAFT_DTO, features: fictionFeatures(), tags: goodTags() });
    expect(complete.diagnostics.passes).toBe(true);
    expect(complete.diagnostics.missingRequired).toEqual([]);
    expect(complete.diagnostics.featureCoverageRatio).toBeGreaterThan(0);
    expect(complete.diagnostics.featureCoverageRatio).toBeLessThan(1);
  });

  it('una clasificación approved no se modifica directamente', async () => {
    const { edition, approved } = await makeApprovedFiction();
    await expect(
      catalog!.saveDraft(ACTOR, approved.id, {
        ...DRAFT_DTO,
        features: [{ featureKey: 'hook_speed', value: 0.5, confidence: 0.5 }],
        tags: [],
      }),
    ).rejects.toThrow(/no se modifica/);
    const stored = await prisma!.bookClassificationVersion.findUniqueOrThrow({
      where: { id: approved.id },
      include: { features: true },
    });
    expect(stored.status).toBe('approved');
    expect([...stored.features.map((feature) => feature.featureKey)].sort()).toEqual([...REQUIRED_FICTION_FEATURES].sort());
    expect(edition.id).toBeTruthy();
  });

  it('una corrección crea una nueva revisión draft con los valores precargados', async () => {
    const { approved } = await makeApprovedFiction();
    const corrected = await catalog!.correct(ACTOR, approved.id);
    expect(corrected.id).not.toBe(approved.id);
    expect(corrected.status).toBe('draft');
    expect(corrected.revision).toBe(approved.revision + 1);
    const approvedValues = approved.features.filter((feature) => feature.value !== null).map((feature) => feature.featureKey).sort();
    const correctedValues = corrected.features.filter((feature) => feature.value !== null).map((feature) => feature.featureKey).sort();
    expect(correctedValues).toEqual(approvedValues);
    expect(corrected.tags.length).toBe(approved.tags.length);
    const storedTags = corrected.tags.map((tag) => tag.tagKey).sort();
    expect(storedTags).toEqual(approved.tags.map((tag) => tag.tagKey).sort());
    await expect(catalog!.saveDraft(ACTOR, approved.id, { ...DRAFT_DTO, features: [], tags: [] })).rejects.toThrow(/no se modifica/);
  });

  it('corregir de nuevo reutiliza el borrador pendiente en lugar de acumular revisiones', async () => {
    const { approved } = await makeApprovedFiction();
    const first = await catalog!.correct(ACTOR, approved.id);
    const second = await catalog!.correct(ACTOR, approved.id);
    expect(second.id).toBe(first.id);
    expect(second.revision).toBe(first.revision);
    const drafts = await prisma!.bookClassificationVersion.findMany({ where: { bookEditionId: first.bookEditionId, status: 'draft' } });
    expect(drafts).toHaveLength(1);
  });

  it('se puede eliminar una revisión en borrador', async () => {
    const { approved } = await makeApprovedFiction();
    const corrected = await catalog!.correct(ACTOR, approved.id);
    const result = await catalog!.deleteClassification(corrected.id);
    expect(result.deleted).toBe(true);
    await expect(prisma!.bookClassificationVersion.findUniqueOrThrow({ where: { id: corrected.id } })).rejects.toThrow();
    const remaining = await prisma!.bookClassificationVersion.findMany({ where: { bookEditionId: corrected.bookEditionId } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.status).toBe('approved');
  });

  it('no se puede eliminar una revisión aprobada', async () => {
    const { approved } = await makeApprovedFiction();
    await expect(catalog!.deleteClassification(approved.id)).rejects.toThrow(/borrador/);
  });

  it('subgenreApplicable es true cuando el genre seleccionado tiene subgéneros y exige al menos uno', async () => {
    const { edition } = await makeEdition();
    const draft = await catalog!.getOrCreateDraft(ACTOR, edition.id, DRAFT_DTO);
    const result = await catalog!.saveDraft(ACTOR, draft.id, {
      ...DRAFT_DTO,
      features: fictionFeatures(),
      tags: [
        { tagKey: 'science_fiction', strength: 0.9, confidence: 0.7 },
        { tagKey: 'identity', strength: 0.6, confidence: 0.6 },
      ],
    });
    expect(result.diagnostics.tags.subgenreApplicable).toBe(true);
    expect(result.diagnostics.tags.subgenre).toBe(0);
    expect(result.diagnostics.passes).toBe(false);
    await expect(catalog!.approve(ACTOR, draft.id)).rejects.toThrow();

    const withSubgenre = await catalog!.saveDraft(ACTOR, draft.id, {
      ...DRAFT_DTO,
      features: fictionFeatures(),
      tags: [
        { tagKey: 'science_fiction', strength: 0.9, confidence: 0.7 },
        { tagKey: 'identity', strength: 0.6, confidence: 0.6 },
        { tagKey: 'space_opera', strength: 0.8, confidence: 0.7 },
      ],
    });
    expect(withSubgenre.diagnostics.tags.subgenre).toBe(1);
    expect(withSubgenre.diagnostics.passes).toBe(true);
    const approved = await catalog!.approve(ACTOR, draft.id);
    expect(approved.status).toBe('approved');
  });

  it('subgenreApplicable es false y aprueba sin subgénero cuando el genre no tiene subgéneros', async () => {
    const { edition } = await makeEdition();
    const draft = await catalog!.getOrCreateDraft(ACTOR, edition.id, DRAFT_DTO);
    const result = await catalog!.saveDraft(ACTOR, draft.id, {
      ...DRAFT_DTO,
      features: fictionFeatures(),
      tags: [
        { tagKey: 'history', strength: 0.8, confidence: 0.7 },
        { tagKey: 'memory', strength: 0.6, confidence: 0.6 },
      ],
    });
    expect(result.diagnostics.tags.subgenreApplicable).toBe(false);
    expect(result.diagnostics.passes).toBe(true);
    const approved = await catalog!.approve(ACTOR, draft.id);
    expect(approved.status).toBe('approved');
  });
});
