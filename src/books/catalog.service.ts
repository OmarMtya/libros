import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BOOK_FEATURE_DEFINITIONS } from '../catalog/book-feature-definitions';
import { featureUiMetadata } from '../catalog/feature-ui-catalog';
import { PrismaService } from '../prisma/prisma.service';
import { evaluateClassificationGate, ClassificationDiagnostics } from '../curation/classification-gate';
import { BooksService } from './books.service';
import { CreateBookDto, CreateClassificationDraftDto, CreateClassificationDto, CreateEditionDto, ManualFeatureInputDto, SaveClassificationDto } from './catalog.dto';

const DEFAULT_CLASSIFIER_VERSION = 'book-tax/1.1.0';
const MANUAL_FEATURE_SOURCE = 'curator_manual';

export function normalizeIsbn(input: string): string | null {
  const cleaned = input.replace(/[^0-9Xx]/g, '');
  if (/^\d{9}[\dXx]$/.test(cleaned)) {
    const body = `978${cleaned.slice(0, 9)}`;
    const sum = body.split('').reduce((acc, digit, index) => acc + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    const check = (10 - (sum % 10)) % 10;
    return `${body}${check}`;
  }
  if (/^\d{13}$/.test(cleaned)) return cleaned;
  return null;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly books: BooksService) {}

  async listBooks(query: string | undefined) {
    const search = query?.trim();
    return this.prisma.book.findMany({
      where: search ? { canonicalTitle: { contains: search, mode: 'insensitive' } } : undefined,
      include: {
        authors: { include: { author: { select: { id: true, canonicalName: true } } }, orderBy: { position: 'asc' } },
        editions: {
          include: {
            contributors: { include: { author: { select: { id: true, canonicalName: true } } }, orderBy: { position: 'asc' } },
            classifications: { include: { features: { orderBy: { featureKey: 'asc' } }, tags: { orderBy: { tagKey: 'asc' } } }, orderBy: { revision: 'desc' } },
          },
          orderBy: { title: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getBook(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: {
        authors: { include: { author: { select: { id: true, canonicalName: true } } }, orderBy: { position: 'asc' } },
        editions: {
          include: {
            contributors: { include: { author: { select: { id: true, canonicalName: true } } }, orderBy: { position: 'asc' } },
            classifications: { include: { features: { orderBy: { featureKey: 'asc' } }, tags: { orderBy: { tagKey: 'asc' } } }, orderBy: { revision: 'desc' } },
          },
          orderBy: { title: 'asc' },
        },
      },
    });
    if (!book) throw new NotFoundException('No se encontró el libro.');
    return book;
  }

  async createBook(actorId: string, dto: CreateBookDto) {
    const editionDetail = dto.openLibraryEditionId ? await this.books.fetchEdition(dto.openLibraryEditionId) : null;
    const isbn = editionDetail?.isbn ? normalizeIsbn(editionDetail.isbn) : null;
    if (isbn) {
      const existing = await this.prisma.bookEdition.findFirst({
        where: { isbn },
        select: { book: { select: { id: true, canonicalTitle: true } } },
      });
      if (existing) {
        throw new ConflictException(`«${dto.canonicalTitle.trim()}» ya está en el catálogo como «${existing.book.canonicalTitle}».`);
      }
    }
    const book = await this.prisma.$transaction(async (tx) => {
      const created = await tx.book.create({
        data: { canonicalTitle: dto.canonicalTitle.trim(), originalLanguage: dto.originalLanguage, openLibraryCoverId: editionDetail?.coverId ?? undefined },
      });
      for (const author of dto.authors ?? []) {
        const authorId = await this.findOrCreateAuthor(tx, author.name.trim());
        await tx.bookAuthor.create({ data: { bookId: created.id, authorId, position: author.position, role: author.role } });
      }
      if (editionDetail && editionDetail.title) {
        await tx.bookEdition.create({
          data: {
            bookId: created.id,
            isbn: editionDetail.isbn ? normalizeIsbn(editionDetail.isbn) : null,
            title: editionDetail.title,
            languageCode: editionDetail.languageCode,
            pages: editionDetail.pages ?? undefined,
            publisher: editionDetail.publisher ?? undefined,
            publicationYear: editionDetail.publicationYear ?? undefined,
          },
        });
      }
      return created;
    });
    return this.getBook(book.id);
  }

  async addEdition(bookId: string, dto: CreateEditionDto) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId }, select: { id: true } });
    if (!book) throw new NotFoundException('No se encontró el libro.');
    const isbn = dto.isbn ? normalizeIsbn(dto.isbn) : null;
    if (dto.isbn && !isbn) throw new BadRequestException('ISBN inválido.');
    return this.prisma.$transaction(async (tx) => {
      const edition = await tx.bookEdition.create({
        data: { bookId, isbn, title: dto.title.trim(), languageCode: dto.languageCode, pages: dto.pages ?? null, publisher: dto.publisher ?? null, publicationYear: dto.publicationYear ?? null },
      });
      for (const contributor of dto.contributors ?? []) {
        const authorId = await this.findOrCreateAuthor(tx, contributor.authorName.trim());
        await tx.editionContributor.create({ data: { bookEditionId: edition.id, authorId, position: contributor.position, role: contributor.role } });
      }
      return edition;
    });
  }

  async createClassification(actorId: string, editionId: string, dto: CreateClassificationDto) {
    const edition = await this.prisma.bookEdition.findUnique({ where: { id: editionId }, select: { id: true } });
    if (!edition) throw new NotFoundException('No se encontró la edición.');
    const contentType = await this.prisma.contentTypeDefinition.findUnique({
      where: { contentTypeKey_schemaVersion: { contentTypeKey: dto.contentTypeKey, schemaVersion: dto.contentTypeSchemaVersion } },
      select: { contentTypeKey: true },
    });
    if (!contentType) throw new BadRequestException('content_type desconocido para la versión indicada.');

    return this.prisma.$transaction(async (tx) => {
      const applicability = await tx.bookFeatureApplicability.findMany({
        where: { featureSchemaVersion: dto.featureSchemaVersion, contentTypeKey: dto.contentTypeKey, contentTypeSchemaVersion: dto.contentTypeSchemaVersion },
        select: { featureKey: true, requirement: true },
      });
      const applicable = new Map(applicability.map((row) => [row.featureKey, row.requirement]));
      const seenFeatures = new Set<string>();
      for (const feature of dto.features) {
        if (seenFeatures.has(feature.featureKey)) throw new BadRequestException(`Feature duplicada: ${feature.featureKey}.`);
        seenFeatures.add(feature.featureKey);
        const definition = await tx.bookFeatureDefinition.findUnique({
          where: { featureKey_schemaVersion: { featureKey: feature.featureKey, schemaVersion: dto.featureSchemaVersion } },
          select: { featureKey: true },
        });
        if (!definition) throw new BadRequestException(`Feature desconocida para la versión ${dto.featureSchemaVersion}: ${feature.featureKey}.`);
        const requirement = applicable.get(feature.featureKey);
        if (!requirement) throw new BadRequestException(`Configuración: sin regla de aplicabilidad para ${feature.featureKey}.`);
        if (requirement === 'not_applicable') throw new BadRequestException(`La feature ${feature.featureKey} no aplica para ${dto.contentTypeKey} y no debe persistirse.`);
      }

      const taxonomy = await tx.tagVersion.findMany({ where: { taxonomicVersion: dto.tagTaxonomyVersion, status: 'active' }, select: { tagKey: true, tagType: true } });
      const taxonomyTypes = new Map(taxonomy.map((row) => [row.tagKey, row.tagType]));
      const seenTags = new Set<string>();
      for (const tag of dto.tags) {
        if (seenTags.has(tag.tagKey)) throw new BadRequestException(`Tag duplicado: ${tag.tagKey}.`);
        seenTags.add(tag.tagKey);
        if (!taxonomyTypes.has(tag.tagKey)) throw new BadRequestException(`Tag desconocido para la versión ${dto.tagTaxonomyVersion}: ${tag.tagKey}.`);
      }

      const latest = await tx.bookClassificationVersion.findFirst({ where: { bookEditionId: editionId }, orderBy: { revision: 'desc' }, select: { revision: true } });
      const revision = (latest?.revision ?? 0) + 1;
      const classifierVersion = dto.classifierVersion ?? DEFAULT_CLASSIFIER_VERSION;
      const classification = await tx.bookClassificationVersion.create({
        data: {
          bookEditionId: editionId,
          contentTypeKey: dto.contentTypeKey,
          contentTypeSchemaVersion: dto.contentTypeSchemaVersion,
          featureSchemaVersion: dto.featureSchemaVersion,
          tagTaxonomyVersion: dto.tagTaxonomyVersion,
          revision,
          classifierVersion,
          status: 'draft',
          createdBy: actorId,
          features: {
            createMany: { data: dto.features.map((feature) => ({ featureKey: feature.featureKey, value: feature.value, confidence: feature.confidence, source: feature.source ?? 'curator_direct', evidenceJson: (feature.evidence ?? {}) as Prisma.InputJsonValue })) },
          },
          tags: {
            createMany: { data: dto.tags.map((tag) => ({ tagKey: tag.tagKey, strength: tag.strength, confidence: tag.confidence })) },
          },
        },
        include: { features: true, tags: true },
      });
      return classification;
    });
  }

  async diagnostics(classificationId: string): Promise<ClassificationDiagnostics> {
    const classification = await this.prisma.bookClassificationVersion.findUnique({
      where: { id: classificationId },
      include: { features: true, tags: true },
    });
    if (!classification) throw new NotFoundException('No se encontró la clasificación.');
    return this.evaluate(classification);
  }

  async getOrCreateDraft(actorId: string, editionId: string, dto: CreateClassificationDraftDto) {
    const edition = await this.prisma.bookEdition.findUnique({ where: { id: editionId }, select: { id: true } });
    if (!edition) throw new NotFoundException('No se encontró la edición.');
    const contentType = await this.prisma.contentTypeDefinition.findUnique({
      where: { contentTypeKey_schemaVersion: { contentTypeKey: dto.contentTypeKey, schemaVersion: dto.contentTypeSchemaVersion } },
      select: { contentTypeKey: true },
    });
    if (!contentType) throw new BadRequestException('content_type desconocido para la versión indicada.');

    const existing = await this.prisma.bookClassificationVersion.findFirst({
      where: { bookEditionId: editionId, status: 'draft' },
      include: { features: true, tags: true },
      orderBy: { revision: 'desc' },
    });
    if (existing) return this.buildEditor(existing);

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.bookClassificationVersion.findFirst({ where: { bookEditionId: editionId }, orderBy: { revision: 'desc' }, select: { revision: true } });
      const revision = (latest?.revision ?? 0) + 1;
      const created = await tx.bookClassificationVersion.create({
        data: {
          bookEditionId: editionId,
          contentTypeKey: dto.contentTypeKey,
          contentTypeSchemaVersion: dto.contentTypeSchemaVersion,
          featureSchemaVersion: dto.featureSchemaVersion,
          tagTaxonomyVersion: dto.tagTaxonomyVersion,
          revision,
          classifierVersion: DEFAULT_CLASSIFIER_VERSION,
          status: 'draft',
          createdBy: actorId,
        },
        include: { features: true, tags: true },
      });
      return this.buildEditor(created);
    });
  }

  async getEditor(classificationId: string) {
    const classification = await this.prisma.bookClassificationVersion.findUnique({
      where: { id: classificationId },
      include: { features: true, tags: true },
    });
    if (!classification) throw new NotFoundException('No se encontró la clasificación.');
    return this.buildEditor(classification);
  }

  async saveDraft(actorId: string, classificationId: string, dto: SaveClassificationDto) {
    const classification = await this.prisma.bookClassificationVersion.findUnique({
      where: { id: classificationId },
      include: { features: true, tags: true },
    });
    if (!classification) throw new NotFoundException('No se encontró la clasificación.');
    if (classification.status !== 'draft') {
      throw new BadRequestException('Una clasificación aprobada no se modifica. Crea una corrección para editar sus valores.');
    }
    await this.assertContentType(dto.contentTypeKey, dto.contentTypeSchemaVersion);

    const applicable = new Map(
      (
        await this.prisma.bookFeatureApplicability.findMany({
          where: { featureSchemaVersion: dto.featureSchemaVersion, contentTypeKey: dto.contentTypeKey, contentTypeSchemaVersion: dto.contentTypeSchemaVersion },
          select: { featureKey: true, requirement: true },
        })
      ).map((row) => [row.featureKey, row.requirement]),
    );

    const seenFeatures = new Set<string>();
    const featuresToSave: { featureKey: string; value: number; confidence: number; notes: string | null }[] = [];
    for (const feature of dto.features) {
      if (seenFeatures.has(feature.featureKey)) throw new BadRequestException(`Feature duplicada: ${feature.featureKey}.`);
      seenFeatures.add(feature.featureKey);
      if (feature.value === undefined || feature.value === null) continue;
      if (feature.confidence === undefined || feature.confidence === null) {
        throw new BadRequestException(`La feature ${feature.featureKey} requiere confidence cuando tiene value.`);
      }
      const definition = await this.prisma.bookFeatureDefinition.findUnique({
        where: { featureKey_schemaVersion: { featureKey: feature.featureKey, schemaVersion: dto.featureSchemaVersion } },
        select: { featureKey: true },
      });
      if (!definition) throw new BadRequestException(`Feature desconocida para la versión ${dto.featureSchemaVersion}: ${feature.featureKey}.`);
      const requirement = applicable.get(feature.featureKey);
      if (!requirement) throw new BadRequestException(`Configuración: sin regla de aplicabilidad para ${feature.featureKey}.`);
      if (requirement === 'not_applicable') {
        throw new BadRequestException(`La feature ${feature.featureKey} no aplica para ${dto.contentTypeKey} y no debe guardarse.`);
      }
      featuresToSave.push({ featureKey: feature.featureKey, value: feature.value, confidence: feature.confidence, notes: feature.notes ?? null });
    }

    const taxonomy = await this.prisma.tagVersion.findMany({ where: { taxonomicVersion: dto.tagTaxonomyVersion, status: 'active' }, select: { tagKey: true } });
    const taxonomyKeys = new Set(taxonomy.map((row) => row.tagKey));
    const seenTags = new Set<string>();
    for (const tag of dto.tags) {
      if (seenTags.has(tag.tagKey)) throw new BadRequestException(`Tag duplicado: ${tag.tagKey}.`);
      seenTags.add(tag.tagKey);
      if (!taxonomyKeys.has(tag.tagKey)) throw new BadRequestException(`Tag desconocido para la versión ${dto.tagTaxonomyVersion}: ${tag.tagKey}.`);
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.bookFeature.deleteMany({ where: { classificationVersionId: classificationId } });
      await tx.bookTag.deleteMany({ where: { classificationVersionId: classificationId } });
      if (featuresToSave.length > 0) {
        await tx.bookFeature.createMany({
          data: featuresToSave.map((feature) => ({
            classificationVersionId: classificationId,
            featureKey: feature.featureKey,
            value: feature.value,
            confidence: feature.confidence,
            source: MANUAL_FEATURE_SOURCE,
            evidenceJson: { notes: feature.notes ?? '' } as Prisma.InputJsonValue,
          })),
        });
      }
      if (dto.tags.length > 0) {
        await tx.bookTag.createMany({
          data: dto.tags.map((tag) => ({ classificationVersionId: classificationId, tagKey: tag.tagKey, strength: tag.strength, confidence: tag.confidence })),
        });
      }
      const updated = await tx.bookClassificationVersion.update({
        where: { id: classificationId },
        data: {
          contentTypeKey: dto.contentTypeKey,
          contentTypeSchemaVersion: dto.contentTypeSchemaVersion,
          featureSchemaVersion: dto.featureSchemaVersion,
          tagTaxonomyVersion: dto.tagTaxonomyVersion,
          optimisticLockVersion: { increment: 1 },
        },
        include: { features: true, tags: true },
      });
      return updated;
    });

    return { classification: await this.buildEditor(saved), diagnostics: await this.evaluate(saved) };
  }

  async correct(actorId: string, classificationId: string) {
    const classification = await this.prisma.bookClassificationVersion.findUnique({
      where: { id: classificationId },
      include: { features: true, tags: true },
    });
    if (!classification) throw new NotFoundException('No se encontró la clasificación.');
    if (classification.status === 'draft') {
      throw new BadRequestException('La clasificación ya está en borrador; edítala directamente.');
    }
    const existingDraft = await this.prisma.bookClassificationVersion.findFirst({
      where: { bookEditionId: classification.bookEditionId, status: 'draft' },
      include: { features: true, tags: true },
      orderBy: { revision: 'desc' },
    });
    if (existingDraft) return this.buildEditor(existingDraft);
    const created = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.bookClassificationVersion.findFirst({ where: { bookEditionId: classification.bookEditionId }, orderBy: { revision: 'desc' }, select: { revision: true } });
      const revision = (latest?.revision ?? 0) + 1;
      return tx.bookClassificationVersion.create({
        data: {
          bookEditionId: classification.bookEditionId,
          contentTypeKey: classification.contentTypeKey,
          contentTypeSchemaVersion: classification.contentTypeSchemaVersion,
          featureSchemaVersion: classification.featureSchemaVersion,
          tagTaxonomyVersion: classification.tagTaxonomyVersion,
          revision,
          classifierVersion: classification.classifierVersion,
          status: 'draft',
          createdBy: actorId,
          supersedesId: classification.id,
          features: {
            create: classification.features.map((feature) => ({
              featureKey: feature.featureKey,
              value: feature.value,
              confidence: feature.confidence,
              source: feature.source,
              evidenceJson: feature.evidenceJson as Prisma.InputJsonValue,
            })),
          },
          tags: {
            create: classification.tags.map((tag) => ({ tagKey: tag.tagKey, strength: tag.strength, confidence: tag.confidence })),
          },
        },
        include: { features: true, tags: true },
      });
    });
    return this.buildEditor(created);
  }

  async deleteClassification(classificationId: string) {
    const classification = await this.prisma.bookClassificationVersion.findUnique({
      where: { id: classificationId },
      select: { id: true, status: true },
    });
    if (!classification) throw new NotFoundException('No se encontró la clasificación.');
    if (classification.status !== 'draft') {
      throw new BadRequestException('Solo se pueden eliminar revisiones en borrador. Para corregir una aprobada, usa «Corregir».');
    }
    const [assignmentCount, candidateCount, feedbackCount] = await Promise.all([
      this.prisma.curationAssignment.count({ where: { classificationVersionId: classificationId } }),
      this.prisma.recommendationCandidate.count({ where: { classificationVersionId: classificationId } }),
      this.prisma.readingFeedback.count({ where: { bookClassificationVersionId: classificationId } }),
    ]);
    if (assignmentCount > 0 || candidateCount > 0 || feedbackCount > 0) {
      throw new BadRequestException('No se puede eliminar: la revisión ya está en uso (asignación, candidato o feedback).');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.bookTag.deleteMany({ where: { classificationVersionId: classificationId } });
      await tx.bookFeature.deleteMany({ where: { classificationVersionId: classificationId } });
      await tx.bookClassificationVersion.delete({ where: { id: classificationId } });
      return { deleted: true, classificationId };
    });
  }

  private async assertContentType(contentTypeKey: string, contentTypeSchemaVersion: string) {
    const contentType = await this.prisma.contentTypeDefinition.findUnique({
      where: { contentTypeKey_schemaVersion: { contentTypeKey, schemaVersion: contentTypeSchemaVersion } },
      select: { contentTypeKey: true },
    });
    if (!contentType) throw new BadRequestException('content_type desconocido para la versión indicada.');
  }

  async featureTemplate(contentTypeKey: string, contentTypeSchemaVersion: string, featureSchemaVersion: string) {
    const [definitions, applicability] = await Promise.all([
      this.prisma.bookFeatureDefinition.findMany({ where: { schemaVersion: featureSchemaVersion }, select: { featureKey: true, scope: true } }),
      this.prisma.bookFeatureApplicability.findMany({
        where: { featureSchemaVersion, contentTypeKey, contentTypeSchemaVersion },
        select: { featureKey: true, requirement: true },
      }),
    ]);
    const requirementByKey = new Map(applicability.map((row) => [row.featureKey, row.requirement]));
    const definitionOrder = new Map(BOOK_FEATURE_DEFINITIONS.map((definition, index) => [definition.featureKey, index]));
    const features = definitions
      .slice()
      .sort((a, b) => (definitionOrder.get(a.featureKey) ?? Number.MAX_SAFE_INTEGER) - (definitionOrder.get(b.featureKey) ?? Number.MAX_SAFE_INTEGER))
      .map((definition) => {
        const meta = featureUiMetadata(definition.featureKey);
        return {
          featureKey: definition.featureKey,
          scope: definition.scope,
          requirement: (requirementByKey.get(definition.featureKey) ?? 'optional') as 'required' | 'optional' | 'not_applicable',
          label: meta.label,
          description: meta.description,
          meaningZero: meta.meaningZero,
          meaningOne: meta.meaningOne,
        };
      });
    return { contentTypeKey, features };
  }

  private async buildEditor(classification: {
    id: string;
    bookEditionId: string;
    revision: number;
    status: string;
    contentTypeKey: string;
    contentTypeSchemaVersion: string;
    featureSchemaVersion: string;
    tagTaxonomyVersion: string;
    classifierVersion: string;
    features: { featureKey: string; value: Prisma.Decimal; confidence: Prisma.Decimal; evidenceJson: Prisma.JsonValue }[];
    tags: { tagKey: string; strength: Prisma.Decimal; confidence: Prisma.Decimal }[];
  }) {
    const [edition, definitions, applicability, taxonomy] = await Promise.all([
      this.prisma.bookEdition.findUnique({ where: { id: classification.bookEditionId }, select: { title: true } }),
      this.prisma.bookFeatureDefinition.findMany({ where: { schemaVersion: classification.featureSchemaVersion }, select: { featureKey: true, scope: true } }),
      this.prisma.bookFeatureApplicability.findMany({
        where: { featureSchemaVersion: classification.featureSchemaVersion, contentTypeKey: classification.contentTypeKey, contentTypeSchemaVersion: classification.contentTypeSchemaVersion },
        select: { featureKey: true, requirement: true },
      }),
      this.prisma.tagVersion.findMany({ where: { taxonomicVersion: classification.tagTaxonomyVersion, status: 'active' }, select: { tagKey: true, name: true, tagType: true } }),
    ]);
    const requirementByKey = new Map(applicability.map((row) => [row.featureKey, row.requirement]));
    const persistedByKey = new Map(classification.features.map((feature) => [feature.featureKey, feature]));
    const definitionOrder = new Map(BOOK_FEATURE_DEFINITIONS.map((definition, index) => [definition.featureKey, index]));

    const features = definitions
      .slice()
      .sort((a, b) => (definitionOrder.get(a.featureKey) ?? Number.MAX_SAFE_INTEGER) - (definitionOrder.get(b.featureKey) ?? Number.MAX_SAFE_INTEGER))
      .map((definition) => {
        const persisted = persistedByKey.get(definition.featureKey);
        const meta = featureUiMetadata(definition.featureKey);
        const evidence = persisted?.evidenceJson as Record<string, unknown> | null | undefined;
        const notes = persisted && typeof evidence?.notes === 'string' ? evidence.notes : null;
        return {
          featureKey: definition.featureKey,
          scope: definition.scope,
          requirement: (requirementByKey.get(definition.featureKey) ?? 'optional') as 'required' | 'optional' | 'not_applicable',
          label: meta.label,
          description: meta.description,
          meaningZero: meta.meaningZero,
          meaningOne: meta.meaningOne,
          value: persisted ? Number(persisted.value) : null,
          confidence: persisted ? Number(persisted.confidence) : null,
          notes,
        };
      });

    const taxonomyByName = new Map(taxonomy.map((row) => [row.tagKey, row]));
    const tags = classification.tags.map((tag) => {
      const definition = taxonomyByName.get(tag.tagKey);
      return {
        tagKey: tag.tagKey,
        name: definition?.name ?? tag.tagKey,
        tagType: definition?.tagType ?? '',
        strength: Number(tag.strength),
        confidence: Number(tag.confidence),
      };
    });

    return {
      id: classification.id,
      bookEditionId: classification.bookEditionId,
      editionTitle: edition?.title ?? '',
      revision: classification.revision,
      status: classification.status,
      contentTypeKey: classification.contentTypeKey,
      contentTypeSchemaVersion: classification.contentTypeSchemaVersion,
      featureSchemaVersion: classification.featureSchemaVersion,
      tagTaxonomyVersion: classification.tagTaxonomyVersion,
      classifierVersion: classification.classifierVersion,
      features,
      tags,
      tagsAvailable: taxonomy.map((row) => ({ tagKey: row.tagKey, name: row.name, tagType: row.tagType })),
    };
  }

  async approve(actorId: string, classificationId: string) {
    const classification = await this.prisma.bookClassificationVersion.findUnique({
      where: { id: classificationId },
      include: { features: true, tags: true },
    });
    if (!classification) throw new NotFoundException('No se encontró la clasificación.');
    if (classification.status !== 'draft') throw new BadRequestException('Solo se pueden aprobar revisiones en estado draft.');
    const result = await this.evaluate(classification);
    if (!result.passes) throw new BadRequestException({ message: 'La clasificación no cumple el mínimo requerido.', diagnostics: result });

    return this.prisma.$transaction(async (tx) => {
      const previousApproved = await tx.bookClassificationVersion.findFirst({
        where: { bookEditionId: classification.bookEditionId, status: 'approved' },
        orderBy: { revision: 'desc' },
      });
      if (previousApproved) {
        await tx.bookClassificationVersion.update({
          where: { id: previousApproved.id },
          data: { status: 'superseded', optimisticLockVersion: { increment: 1 } },
        });
      }
      return tx.bookClassificationVersion.update({
        where: { id: classification.id },
        data: { status: 'approved', approvedBy: actorId, approvedAt: new Date(), supersedesId: previousApproved?.id ?? null, optimisticLockVersion: { increment: 1 } },
        include: { features: true, tags: true },
      });
    });
  }

  private async evaluate(classification: { id: string; featureSchemaVersion: string; contentTypeKey: string; contentTypeSchemaVersion: string; tagTaxonomyVersion: string }): Promise<ClassificationDiagnostics> {
    const [definitions, applicability, presentFeatures, tags, taxonomy] = await Promise.all([
      this.prisma.bookFeatureDefinition.findMany({ where: { schemaVersion: classification.featureSchemaVersion, isActive: true }, select: { featureKey: true, schemaVersion: true } }),
      this.prisma.bookFeatureApplicability.findMany({
        where: { featureSchemaVersion: classification.featureSchemaVersion, contentTypeKey: classification.contentTypeKey, contentTypeSchemaVersion: classification.contentTypeSchemaVersion },
        select: { featureKey: true, requirement: true },
      }),
      this.prisma.bookFeature.findMany({ where: { classificationVersionId: classification.id }, select: { featureKey: true } }),
      this.prisma.bookTag.findMany({ where: { classificationVersionId: classification.id }, select: { tagKey: true } }),
      this.prisma.tagVersion.findMany({ where: { taxonomicVersion: classification.tagTaxonomyVersion }, select: { tagKey: true, tagType: true, parentTagKey: true } }),
    ]);
    const presentTagKeys = new Set(tags.map((tag) => tag.tagKey));
    const genreKeys = taxonomy.filter((row) => row.tagType === 'genre' && presentTagKeys.has(row.tagKey)).map((row) => row.tagKey);
    const applicableSubgenreKeys = taxonomy.filter((row) => row.tagType === 'subgenre' && row.parentTagKey !== null && genreKeys.includes(row.parentTagKey)).map((row) => row.tagKey);
    return evaluateClassificationGate({
      featureDefinitions: definitions,
      applicability: applicability as { featureKey: string; requirement: 'required' | 'optional' | 'not_applicable' }[],
      presentFeatureKeys: presentFeatures.map((feature) => feature.featureKey),
      tags: taxonomy.filter((row) => presentTagKeys.has(row.tagKey)).map((row) => ({ tagKey: row.tagKey, tagType: row.tagType })),
      applicableSubgenreKeys,
    });
  }

  async deleteBook(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      include: { editions: { select: { id: true } } },
    });
    if (!book) throw new NotFoundException('No se encontró el libro.');
    const editionIds = book.editions.map((edition) => edition.id);

    const [assignmentCount, feedbackCount, candidateCount, readerEvidenceCount] = await Promise.all([
      editionIds.length > 0
        ? this.prisma.curationAssignment.count({ where: { bookEditionId: { in: editionIds } } })
        : 0,
      editionIds.length > 0
        ? this.prisma.readingFeedback.count({ where: { bookEditionId: { in: editionIds } } })
        : 0,
      editionIds.length > 0
        ? this.prisma.recommendationCandidate.count({ where: { bookEditionId: { in: editionIds } } })
        : 0,
      this.prisma.readerEvidence.count({ where: { bookId } }),
    ]);

    if (assignmentCount > 0 || feedbackCount > 0 || candidateCount > 0 || readerEvidenceCount > 0) {
      throw new BadRequestException('No se puede eliminar: el libro ya está asignado a un cliente o tiene actividad (curación, feedback o recomendaciones).');
    }

    return this.prisma.$transaction(async (tx) => {
      const classificationIds = await tx.bookClassificationVersion.findMany({
        where: { bookEditionId: { in: editionIds } },
        select: { id: true },
      });
      const classificationIdList = classificationIds.map((row) => row.id);
      if (classificationIdList.length > 0) {
        await tx.bookTag.deleteMany({ where: { classificationVersionId: { in: classificationIdList } } });
        await tx.bookFeature.deleteMany({ where: { classificationVersionId: { in: classificationIdList } } });
      }
      await tx.bookClassificationVersion.deleteMany({ where: { bookEditionId: { in: editionIds } } });
      await tx.editionContributor.deleteMany({ where: { bookEditionId: { in: editionIds } } });
      await tx.bookEdition.deleteMany({ where: { id: { in: editionIds } } });
      await tx.bookAuthor.deleteMany({ where: { bookId } });
      const orphanAuthors = await tx.author.findMany({
        where: {
          AND: [
            { books: { none: {} } },
            { editionContributions: { none: {} } },
          ],
        },
        select: { id: true },
      });
      if (orphanAuthors.length > 0) {
        await tx.author.deleteMany({ where: { id: { in: orphanAuthors.map((author) => author.id) } } });
      }
      await tx.book.delete({ where: { id: bookId } });
      return { deleted: true, bookId };
    });
  }

  private async findOrCreateAuthor(tx: Prisma.TransactionClient, canonicalName: string): Promise<string> {
    const existing = await tx.author.findFirst({ where: { canonicalName }, select: { id: true } });
    if (existing) return existing.id;
    const created = await tx.author.create({ data: { canonicalName } });
    return created.id;
  }
}
