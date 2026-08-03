import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookContextService } from './book-context.service';
import { buildClassificationSystemPrompt, buildClassificationUserMessage } from './book-classification-prompt';
import { DeepseekClient } from './deepseek.client';

const AI_CONFIDENCE_CAP = 0.95;

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

type ProposalEntry = { value?: unknown; confidence?: unknown; strength?: unknown };

export type AiProposal = {
  contentTypeKey: string;
  contentTypeSchemaVersion: string;
  featureSchemaVersion: string;
  tagTaxonomyVersion: string;
  features: Record<string, { value: number; confidence: number }>;
  tags: Record<string, { strength: number; confidence: number }>;
};

@Injectable()
export class BookClassificationAiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deepseek: DeepseekClient,
    private readonly bookContext: BookContextService,
  ) {}

  async proposeFromMarkdown(classificationId: string, markdown: string): Promise<AiProposal> {
    const classification = await this.prisma.bookClassificationVersion.findUnique({
      where: { id: classificationId },
      include: {
        edition: {
          include: {
            book: { include: { authors: { include: { author: { select: { canonicalName: true } } } } } },
          },
        },
      },
    });
    if (!classification) throw new NotFoundException('No se encontró la clasificación.');
    if (classification.status !== 'draft') {
      throw new BadRequestException('La clasificación debe estar en borrador para proponer valores con IA.');
    }

    const applicability = await this.prisma.bookFeatureApplicability.findMany({
      where: {
        featureSchemaVersion: classification.featureSchemaVersion,
        contentTypeKey: classification.contentTypeKey,
        contentTypeSchemaVersion: classification.contentTypeSchemaVersion,
      },
      select: { featureKey: true, requirement: true },
    });
    const applicableFeatureKeys = applicability
      .filter((row) => row.requirement !== 'not_applicable')
      .map((row) => row.featureKey);

    const externalContext = await this.bookContext
      .buildBlock({
        isbn: classification.edition.isbn,
        canonicalTitle: classification.edition.book.canonicalTitle,
        authors: classification.edition.book.authors.map((item) => item.author.canonicalName),
        languageCode: classification.edition.languageCode,
      })
      .catch(() => '');

    const system = buildClassificationSystemPrompt(classification.contentTypeKey, applicableFeatureKeys);
    const user = buildClassificationUserMessage({
      editionContext: this.editionContext(classification),
      markdown,
      contentTypeKey: classification.contentTypeKey,
      externalContext,
    });
    const raw = await this.deepseek.chatJson({ system, user });

    return this.normalizeProposal(classification, raw, applicability);
  }

  private editionContext(classification: {
    edition: {
      title: string;
      languageCode: string;
      publisher: string | null;
      publicationYear: number | null;
      isbn?: string | null;
      book: { canonicalTitle: string; authors: Array<{ author: { canonicalName: string } }> };
    };
  }): string {
    const edition = classification.edition;
    const authors = edition.book.authors.map((item) => item.author.canonicalName).join(', ');
    return [
      `Título de la edición: ${edition.title}`,
      `Título de la obra: ${edition.book.canonicalTitle}`,
      authors ? `Autor(es): ${authors}` : null,
      edition.publisher ? `Editorial: ${edition.publisher}` : null,
      edition.publicationYear ? `Año: ${edition.publicationYear}` : null,
      edition.isbn ? `ISBN: ${edition.isbn}` : null,
      `Idioma: ${edition.languageCode}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async normalizeProposal(
    classification: {
      contentTypeKey: string;
      contentTypeSchemaVersion: string;
      featureSchemaVersion: string;
      tagTaxonomyVersion: string;
    },
    raw: Record<string, unknown>,
    applicability: Array<{ featureKey: string; requirement: string }>,
  ): Promise<AiProposal> {
    const activeTags = await this.prisma.tagVersion.findMany({
      where: { taxonomicVersion: classification.tagTaxonomyVersion, status: 'active' },
      select: { tagKey: true },
    });
    const requirementByKey = new Map(applicability.map((row) => [row.featureKey, row.requirement]));
    const activeTagKeys = new Set(activeTags.map((tag) => tag.tagKey));

    const rawFeatures = (raw?.features ?? {}) as Record<string, ProposalEntry>;
    const rawTags = (raw?.tags ?? {}) as Record<string, ProposalEntry>;

    const features: Record<string, { value: number; confidence: number }> = {};
    for (const [featureKey, entry] of Object.entries(rawFeatures)) {
      const requirement = requirementByKey.get(featureKey);
      if (!requirement || requirement === 'not_applicable') continue;
      const value = finite(entry?.value, 0, 1);
      if (value === null) continue;
      const confidence = finite(entry?.confidence, 0, AI_CONFIDENCE_CAP) ?? 0;
      features[featureKey] = { value: round4(value), confidence: round4(confidence) };
    }

    for (const row of applicability) {
      if (row.requirement === 'not_applicable') continue;
      if (features[row.featureKey]) continue;
      features[row.featureKey] = { value: 0.5, confidence: 0.15 };
    }

    const tags: Record<string, { strength: number; confidence: number }> = {};
    for (const [tagKey, entry] of Object.entries(rawTags)) {
      if (!activeTagKeys.has(tagKey)) continue;
      const strength = finite(entry?.strength, 0, 1);
      if (strength === null) continue;
      const confidence = finite(entry?.confidence, 0, AI_CONFIDENCE_CAP) ?? 0;
      tags[tagKey] = { strength: round4(strength), confidence: round4(confidence) };
    }

    return {
      contentTypeKey: classification.contentTypeKey,
      contentTypeSchemaVersion: classification.contentTypeSchemaVersion,
      featureSchemaVersion: classification.featureSchemaVersion,
      tagTaxonomyVersion: classification.tagTaxonomyVersion,
      features,
      tags,
    };
  }
}

function finite(raw: unknown, min: number, max: number): number | null {
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}
