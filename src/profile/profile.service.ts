import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { EvidenceStatus, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { CALCULATION_VERSION, DIMENSIONS, isQuestionVisible, ONBOARDING_CORE_DIMENSIONS, PROFILE_SCHEMA_VERSION, TAG_TAXONOMY_VERSION } from './catalog';
import { aggregateDimension, evidenceSetHash, round } from './profile-calculation';
import { computeDimensionWeights, computeDomainWeights, NumericDomain, SCORING_CALCULATION_VERSION } from '../scoring/domain-weights';
import { buildPriorityVector, PriorityFactor, priorityVectorHash, PriorityVector, PRIORITY_VECTOR_MAPPING_VERSION, PRIORITY_VECTOR_NORMALIZATION_METHOD } from '../scoring/priority-vector';
import { OperationalConstraints, readyToRecommend } from './profile-readiness';
import { PrismaService } from '../prisma/prisma.service';

type PrioritySnapshot = {
  ranking: PriorityFactor[];
  priorityVector: PriorityVector;
  domainWeights: Record<NumericDomain, number>;
  dimensionWeights: Record<string, number>;
};

export type SupplementalBook = {
  category: 'enjoyed' | 'notEnjoyed';
  openLibraryId: string;
  openLibraryEditionId: string | null;
  coverId: number | null;
  title: string;
  authors: string[];
  coverUrl: string | null;
  rating: number;
  likedAspects: string[];
  reasonCodes: string[];
  freeText: string | null;
};

const LOVED_BOOK_ASPECT_KEYS = new Set(['characters', 'prose', 'originality', 'ending', 'emotions', 'universe']);
const DISLIKED_BOOK_REASON_KEYS = new Set(['too_conceptually_dense', 'too_slow', 'too_confusing', 'too_long', 'not_engaging', 'other']);

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureProfile(userId: string) {
    await this.prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
    let profile;
    try {
      profile = await this.prisma.readerProfile.upsert({
        where: { userId },
        create: {
          userId,
          schemaVersion: PROFILE_SCHEMA_VERSION,
          snapshotJson: {},
          dimensions: { createMany: { data: DIMENSIONS.map((dimension) => ({ dimensionKey: dimension.key })) } },
        },
        update: {},
      });
    } catch (error) {
      const target = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta?.target : undefined;
      const targetFields = Array.isArray(target) ? target : [target];
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || !targetFields.includes('user_id')) throw error;
      profile = await this.prisma.readerProfile.findUniqueOrThrow({ where: { userId } });
    }
    await this.ensurePublicSlug(profile.id);
    return this.prisma.readerProfile.findUniqueOrThrow({ where: { userId } });
  }

  async ensurePublicSlug(profileId: string): Promise<string> {
    const existing = await this.prisma.readerProfile.findUniqueOrThrow({ where: { id: profileId }, select: { publicSlug: true } });
    if (existing.publicSlug) return existing.publicSlug;
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = randomBytes(12).toString('base64url');
      try {
        const updated = await this.prisma.readerProfile.update({ where: { id: profileId }, data: { publicSlug: slug }, select: { publicSlug: true } });
        return updated.publicSlug!;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      }
    }
    throw new ConflictException('No se pudo generar un slug público único.');
  }

  async getProfile(userId: string) {
    await this.ensureProfile(userId);
    const profile = await this.prisma.readerProfile.findUnique({
      where: { userId },
      include: {
        dimensions: { orderBy: { dimensionKey: 'asc' } },
        tagPreferences: { orderBy: { tagKey: 'asc' } },
        operationalConstraints: true,
        conditionalRules: true,
        positiveTriggers: { include: { evidence: true } },
        evidence: { orderBy: [{ status: 'asc' }, { createdAt: 'asc' }] },
        user: {
          select: {
            displayName: true,
            avatarUrl: true,
            questionnaireSessions: {
              orderBy: { startedAt: 'desc' },
              include: { answers: { orderBy: { answeredAt: 'asc' } } },
            },
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Reader profile not found.');
    const { user, ...readerProfile } = profile;
    const feedbackBooks = await this.prisma.readingFeedback.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        started: true,
        notStartedReason: true,
        readingStatus: true,
        completionPercentage: true,
        selectionFitRating: true,
        outcomeAttribution: true,
        freeText: true,
        isFinal: true,
        submittedAt: true,
        aspects: {
          select: { polarity: true, optionKey: true },
        },
        edition: {
          select: {
            title: true,
            book: {
              select: {
                id: true,
                canonicalTitle: true,
                openLibraryCoverId: true,
                authors: { include: { author: { select: { canonicalName: true } } }, orderBy: { position: 'asc' } },
              },
            },
          },
        },
      },
    });
    const seenBooks = new Set<string>();
    const feedbackBooksMapped: Array<{
      id: string;
      bookId: string;
      title: string;
      authors: string[];
      readingStatus: string;
      selectionFitRating: number | null;
      isFinal: boolean;
      submittedAt: Date;
      coverUrl: string | null;
      started: boolean;
      completionPercentage: number;
      notStartedReason: string | null;
      outcomeAttribution: string | null;
      positiveAspects: string[];
      negativeAspects: string[];
      freeText: string | null;
    }> = [];
    for (const feedback of feedbackBooks) {
      const book = feedback.edition?.book;
      const bookId = book?.id ?? '';
      if (bookId && seenBooks.has(bookId)) continue;
      if (bookId) seenBooks.add(bookId);
      const coverId = book?.openLibraryCoverId ?? null;
      feedbackBooksMapped.push({
        id: feedback.id,
        bookId,
        title: book?.canonicalTitle ?? feedback.edition?.title ?? 'Libro sin título',
        authors: book?.authors.map((item) => item.author.canonicalName) ?? [],
        readingStatus: feedback.readingStatus,
        selectionFitRating: feedback.selectionFitRating,
        isFinal: feedback.isFinal,
        submittedAt: feedback.submittedAt,
        coverUrl: coverId !== null ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
        started: feedback.started,
        completionPercentage: feedback.completionPercentage,
        notStartedReason: feedback.notStartedReason,
        outcomeAttribution: feedback.outcomeAttribution,
        positiveAspects: feedback.aspects.filter((aspect) => aspect.polarity === 'positive').map((aspect) => aspect.optionKey),
        negativeAspects: feedback.aspects.filter((aspect) => aspect.polarity === 'negative').map((aspect) => aspect.optionKey),
        freeText: feedback.freeText,
      });
    }
    return { ...readerProfile, displayName: user.displayName, avatarUrl: user.avatarUrl, questionnaireSessions: user.questionnaireSessions, feedbackBooks: feedbackBooksMapped };
  }

  async addSupplementalBooks(userId: string, rawBooks: unknown): Promise<{ books: SupplementalBook[] }> {
    const books = this.validateSupplementalBooks(rawBooks);
    const profile = await this.ensureProfile(userId);
    const current = await this.prisma.readerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    const currentMeta = current.snapshotJson as Record<string, unknown>;
    const existing = this.readSupplementalBooks(currentMeta.supplemental_books);
    const merged = [...existing];

    for (const book of books) {
      const index = merged.findIndex((item) => item.openLibraryId === book.openLibraryId);
      if (index >= 0) merged[index] = book;
      else merged.push(book);
    }
    if (merged.length > 50) throw new BadRequestException('Puedes guardar hasta 50 libros en tu estantería.');

    const updated = await this.prisma.readerProfile.updateMany({
      where: { id: current.id, optimisticLockVersion: current.optimisticLockVersion },
      data: {
        snapshotJson: { ...currentMeta, supplemental_books: merged } as Prisma.InputJsonValue,
        optimisticLockVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new ConflictException('Profile changed concurrently. Retry the operation.');
    return { books: merged };
  }

  async removeSupplementalBook(userId: string, rawOpenLibraryId: string): Promise<{ books: SupplementalBook[] }> {
    const openLibraryId = rawOpenLibraryId.trim().slice(0, 120);
    if (!openLibraryId) throw new BadRequestException('El identificador del libro es obligatorio.');
    const profile = await this.ensureProfile(userId);
    const current = await this.prisma.readerProfile.findUniqueOrThrow({ where: { id: profile.id } });
    const currentMeta = current.snapshotJson as Record<string, unknown>;
    const existing = this.readSupplementalBooks(currentMeta.supplemental_books);
    const books = existing.filter((book) => book.openLibraryId !== openLibraryId);
    if (books.length === existing.length) return { books: existing };

    const updated = await this.prisma.readerProfile.updateMany({
      where: { id: current.id, optimisticLockVersion: current.optimisticLockVersion },
      data: {
        snapshotJson: { ...currentMeta, supplemental_books: books } as Prisma.InputJsonValue,
        optimisticLockVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new ConflictException('Profile changed concurrently. Retry the operation.');
    return { books };
  }

  async getVersions(userId: string) {
    const profile = await this.ensureProfile(userId);
    return this.prisma.readerProfileVersion.findMany({ where: { profileId: profile.id }, orderBy: { version: 'desc' } });
  }

  async getDiagnostics(userId: string) {
    const profile = await this.getProfile(userId);
    const dimensions = profile.dimensions.filter((dimension) => ONBOARDING_CORE_DIMENSIONS.has(dimension.dimensionKey));
    const known = dimensions.filter((dimension) => dimension.value !== null && new Decimal(dimension.confidence).gte(0.15));
    const missing = dimensions.filter((dimension) => !known.includes(dimension));
    return {
      profile,
      coreDimensions: {
        denominator: ONBOARDING_CORE_DIMENSIONS.size,
        keys: [...ONBOARDING_CORE_DIMENSIONS],
        known: known.map((dimension) => dimension.dimensionKey),
        missing: missing.map((dimension) => dimension.dimensionKey),
      },
    };
  }

  async recompute(userId: string, changeReason: string, sourceId?: string) {
    const profile = await this.ensureProfile(userId);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.readerProfile.findUniqueOrThrow({ where: { id: profile.id } });
      const evidence = await tx.readerEvidence.findMany({
        where: { profileId: current.id, status: EvidenceStatus.active },
        orderBy: { evidenceFingerprint: 'asc' },
      });
      const hash = evidenceSetHash(evidence.map((item) => item.evidenceFingerprint));
      const tagEvidence = await tx.readerTagEvidence.findMany({
        where: { profileId: current.id, status: EvidenceStatus.active },
        orderBy: { evidenceFingerprint: 'asc' },
      });
      const tagHash = evidenceSetHash(tagEvidence.map((item) => item.evidenceFingerprint));
      const priority = await this.loadPriority(tx, userId, current.id);
      const priorityHash = priority ? priorityVectorHash(priority) : null;
      const currentMeta = current.snapshotJson as Record<string, unknown>;
      if (currentMeta.evidence_set_hash === hash && currentMeta.calculation_version === CALCULATION_VERSION && currentMeta.priority_vector_hash === priorityHash && currentMeta.tag_evidence_hash === tagHash) {
        const persistedDimensions = await tx.readerProfileDimension.findMany({ where: { profileId: current.id } });
        const ready = await this.readyToRecommend(tx, userId, persistedDimensions);
        const currentReady = current.readyToRecommend === ready ? current : await tx.readerProfile.update({ where: { id: current.id }, data: { readyToRecommend: ready } });
        const version = await tx.readerProfileVersion.findUnique({ where: { profileId_version: { profileId: current.id, version: current.currentVersion } } });
        return { profile: currentReady, version, created: false };
      }

      const byDimension = new Map<string, typeof evidence>();
      for (const item of evidence) byDimension.set(item.dimensionKey, [...(byDimension.get(item.dimensionKey) ?? []), item]);
      const dimensions = await tx.readerProfileDimension.findMany({ where: { profileId: current.id } });
      const computed = dimensions.map((dimension) => ({
        key: dimension.dimensionKey,
        aggregate: aggregateDimension((byDimension.get(dimension.dimensionKey) ?? []).map((item) => ({
          dimensionKey: item.dimensionKey,
          observedValue: item.observedValue,
          finalWeight: item.finalWeight,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          createdAt: item.createdAt,
        }))),
      }));
      const coverage = (keys: Set<string> | null) => {
        const applicable = keys ? computed.filter((item) => keys.has(item.key)) : computed;
        return new Decimal(applicable.filter((item) => item.aggregate.value !== null && item.aggregate.confidence.gte(0.15)).length).div(applicable.length || 1);
      };
      const globalCoverage = coverage(null);
      const coreCoverage = coverage(ONBOARDING_CORE_DIMENSIONS);
      const totalWeight = computed.reduce((sum, item) => sum.plus(item.aggregate.totalEvidenceWeight), new Decimal(0));
      const maturity = Decimal.min(0.95, new Decimal(1).minus(new Decimal(-1).mul(totalWeight).div(30).exp()));
      const nextVersion = current.currentVersion + 1;
      const snapshot = {
        calculation_version: CALCULATION_VERSION,
        classifier_version: 'book-tax/1.1.0',
        tag_taxonomy_version: TAG_TAXONOMY_VERSION,
        prompt_version: 'prompt/evidence-extract/v1',
        evidence_set_hash: hash,
        tag_evidence_hash: tagHash,
        computed_at: new Date().toISOString(),
        priority_vector_hash: priorityHash,
        priority: priority ? {
          ranking: priority.ranking,
          priority_vector: priority.priorityVector,
          normalization_method: PRIORITY_VECTOR_NORMALIZATION_METHOD,
          mapping_version: PRIORITY_VECTOR_MAPPING_VERSION,
          domain_weights: priority.domainWeights,
          dimension_weights: priority.dimensionWeights,
          calculation_version: SCORING_CALCULATION_VERSION,
        } : null,
        goodreads_import: currentMeta.goodreads_import ?? null,
        goodreads_library: currentMeta.goodreads_library ?? [],
        supplemental_books: this.readSupplementalBooks(currentMeta.supplemental_books),
        dimensions: Object.fromEntries(computed.map((item) => [item.key, {
          value: item.aggregate.value?.toFixed(4) ?? null,
          confidence: item.aggregate.confidence.toFixed(4),
          evidence_count: item.aggregate.evidenceCount,
          total_evidence_weight: item.aggregate.totalEvidenceWeight.toFixed(4),
        }])),
      };
      for (const item of computed) {
        await tx.readerProfileDimension.update({
          where: { profileId_dimensionKey: { profileId: current.id, dimensionKey: item.key } },
          data: { value: item.aggregate.value, confidence: item.aggregate.confidence, evidenceCount: item.aggregate.evidenceCount, totalEvidenceWeight: item.aggregate.totalEvidenceWeight, lastEvidenceAt: item.aggregate.lastEvidenceAt },
        });
      }
      const ready = await this.readyToRecommend(tx, userId, computed.map((item) => ({
        key: item.key,
        value: item.aggregate.value,
        confidence: item.aggregate.confidence,
      })));
      const updated = await tx.readerProfile.updateMany({
        where: { id: current.id, currentVersion: current.currentVersion, optimisticLockVersion: current.optimisticLockVersion },
        data: {
          currentVersion: nextVersion,
          optimisticLockVersion: { increment: 1 },
          globalProfileCoverage: round(globalCoverage),
          onboardingCoreCoverage: round(coreCoverage),
          evidenceMaturity: round(maturity),
          overallConfidence: round(Decimal.min(0.95, coreCoverage.mul(0.5).plus(maturity.mul(0.5)))),
          readyToRecommend: ready,
          snapshotJson: snapshot,
        },
      });
      if (updated.count !== 1) throw new ConflictException('Profile changed concurrently. Retry the operation.');
      const version = await tx.readerProfileVersion.create({
        data: {
          profileId: current.id,
          version: nextVersion,
          snapshotJson: snapshot,
          changeReason,
          sourceId: sourceId ?? null,
          evidenceLinks: { createMany: { data: evidence.map((item) => ({ evidenceId: item.id })) } },
        },
      });
      const updatedProfile = await tx.readerProfile.findUniqueOrThrow({ where: { id: current.id } });
      return { profile: updatedProfile, version, created: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async loadPriority(tx: Prisma.TransactionClient, userId: string, profileId: string): Promise<PrioritySnapshot | null> {
    const answer = await tx.questionAnswer.findFirst({
      where: { userId, questionKey: 'Q03_PRIORITY_RANKING' },
      orderBy: { answeredAt: 'desc' },
      select: { normalizedResponse: true },
    });
    if (!answer) return null;
    const normalized = answer.normalizedResponse as { ranking?: unknown } | null;
    const ranking = Array.isArray(normalized?.ranking) ? normalized.ranking.filter((item): item is PriorityFactor => typeof item === 'string' && (['plot', 'characters', 'ideas', 'atmosphere', 'style', 'emotion'] as const).includes(item as PriorityFactor)) : null;
    if (!ranking) return null;
    let priorityVector: PriorityVector;
    try {
      priorityVector = buildPriorityVector(ranking);
    } catch {
      return null;
    }
    const dimensions = await tx.readerProfileDimension.findMany({ where: { profileId } });
    const activeDimensions = dimensions.filter((dimension) => dimension.value !== null && new Decimal(dimension.confidence).gte(0.15)).map((dimension) => dimension.dimensionKey);
    const domainWeights = computeDomainWeights(priorityVector);
    const dimensionWeights = computeDimensionWeights(domainWeights, activeDimensions);
    return { ranking, priorityVector, domainWeights, dimensionWeights };
  }

  private async hasCompletedRequiredQuestions(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
    const required = await tx.questionDefinition.findMany({ where: { isActive: true, isRequired: true }, select: { questionKey: true, questionnaireVersion: true } });
    const sessions = await tx.questionnaireSession.findMany({ where: { userId, status: 'completed' }, include: { answers: { select: { questionKey: true, normalizedResponse: true } } } });
    return sessions.some((session) => {
      const answered = new Set(session.answers.map((answer) => answer.questionKey));
      const answeredMap = new Map(session.answers.map((answer) => [answer.questionKey, answer.normalizedResponse]));
      return required
        .filter((question) => question.questionnaireVersion === session.questionnaireVersion && isQuestionVisible(question.questionKey, answeredMap))
        .every((question) => answered.has(question.questionKey));
    });
  }

  private async readyToRecommend(tx: Prisma.TransactionClient, userId: string, dimensions: Array<{ dimensionKey: string; value: Decimal | null; confidence: Decimal }> | Array<{ key: string; value: Decimal | null; confidence: Decimal }>): Promise<boolean> {
    const [requiredQuestionsComplete, completedSession, constraints] = await Promise.all([
      this.hasCompletedRequiredQuestions(tx, userId),
      tx.questionnaireSession.findFirst({ where: { userId, status: 'completed' }, select: { id: true } }),
      tx.readerOperationalConstraints.findFirst({ where: { profile: { userId } } }),
    ]);
    const signals = dimensions.map((dimension) => ({
      key: 'key' in dimension ? dimension.key : dimension.dimensionKey,
      value: dimension.value,
      confidence: new Decimal(dimension.confidence),
    }));
    return readyToRecommend({
      requiredQuestionsComplete,
      questionnaireSessionCompleted: completedSession !== null,
      dimensions: signals,
      constraints: this.constraintsFrom(constraints),
    });
  }

  private constraintsFrom(constraints: { preferredPagesMin: number | null; preferredPagesMax: number | null; seriesPreference: string | null; acceptedLanguagesJson: unknown; acceptedFormatsJson: unknown } | null): OperationalConstraints | null {
    if (!constraints) return null;
    return {
      preferredPagesMin: constraints.preferredPagesMin,
      preferredPagesMax: constraints.preferredPagesMax,
      seriesPreference: constraints.seriesPreference,
      acceptedLanguages: this.stringArray(constraints.acceptedLanguagesJson),
      acceptedFormats: this.stringArray(constraints.acceptedFormatsJson),
    };
  }

  private validateSupplementalBooks(value: unknown): SupplementalBook[] {
    if (!Array.isArray(value) || value.length === 0) throw new BadRequestException('Agrega al menos un libro.');
    return value.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new BadRequestException(`El libro ${index + 1} no es válido.`);
      const raw = item as Record<string, unknown>;
      const category = raw.category === 'enjoyed' || raw.category === 'notEnjoyed' ? raw.category : null;
      const openLibraryId = typeof raw.openLibraryId === 'string' ? raw.openLibraryId.trim().slice(0, 120) : '';
      const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 300) : '';
      if (!category || !openLibraryId || !title) throw new BadRequestException(`El libro ${index + 1} necesita título, identificador y clasificación.`);
      const authors = Array.isArray(raw.authors) ? raw.authors.filter((author): author is string => typeof author === 'string').map((author) => author.trim().slice(0, 160)).filter(Boolean).slice(0, 10) : [];
      const coverId = raw.coverId === null || raw.coverId === undefined ? null : typeof raw.coverId === 'number' && Number.isInteger(raw.coverId) && raw.coverId > 0 ? raw.coverId : null;
      const coverUrl = typeof raw.coverUrl === 'string' && raw.coverUrl.trim() ? raw.coverUrl.trim().slice(0, 1000) : null;
      const rating = typeof raw.rating === 'number' && Number.isInteger(raw.rating) && raw.rating >= 1 && raw.rating <= 5 ? raw.rating : null;
      const likedAspects = Array.isArray(raw.likedAspects) ? raw.likedAspects.filter((item): item is string => typeof item === 'string' && LOVED_BOOK_ASPECT_KEYS.has(item)) : [];
      const reasonCodes = Array.isArray(raw.reasonCodes) ? raw.reasonCodes.filter((item): item is string => typeof item === 'string' && DISLIKED_BOOK_REASON_KEYS.has(item)) : [];
      const freeText = raw.freeText === null || raw.freeText === undefined ? null : typeof raw.freeText === 'string' ? raw.freeText.trim().slice(0, 2000) || null : null;
      if (rating === null) throw new BadRequestException(`El libro ${index + 1} necesita una calificación de 1 a 5.`);
      if (category === 'enjoyed' && likedAspects.length === 0) throw new BadRequestException(`El libro ${index + 1} necesita al menos un aspecto positivo.`);
      if (category === 'notEnjoyed' && reasonCodes.length === 0) throw new BadRequestException(`El libro ${index + 1} necesita al menos un motivo.`);
      return {
        category,
        openLibraryId,
        openLibraryEditionId: typeof raw.openLibraryEditionId === 'string' ? raw.openLibraryEditionId.trim().slice(0, 120) : null,
        coverId,
        title,
        authors,
        coverUrl,
        rating,
        likedAspects: [...new Set(likedAspects)],
        reasonCodes: [...new Set(reasonCodes)],
        freeText,
      };
    });
  }

  private readSupplementalBooks(value: unknown): SupplementalBook[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SupplementalBook => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
      const raw = item as Record<string, unknown>;
      return (raw.category === 'enjoyed' || raw.category === 'notEnjoyed')
        && typeof raw.openLibraryId === 'string'
        && typeof raw.title === 'string'
        && raw.title.trim().length > 0;
    });
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }
}
