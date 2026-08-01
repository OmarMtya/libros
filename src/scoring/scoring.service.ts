import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CandidateReviewStatus, MatchingOperator, Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from '../profile/profile.service';
import { DIMENSIONS } from '../profile/catalog';
import { SlowBurnCompensatorsRule, slowBurnRiskPenalty } from '../profile/conditional-rules';
import { evidenceSetHash } from '../profile/profile-calculation';
import { buildPriorityVector, PriorityVector, priorityVectorHash } from './priority-vector';
import { SCORING_CALCULATION_VERSION } from './domain-weights';
import {
  BookFeatureMap,
  BookTagSignal,
  coveragePenalty,
  finalScore,
  lengthFit,
  numericFit,
  recommendationEvidenceCoverage,
  ReaderDimension,
  round4,
  tagFit,
  UserTag,
} from './compatibility';

const DIMENSION_META = new Map(DIMENSIONS.map((dimension) => [dimension.key, dimension]));

type RiskResult = {
  total: Decimal;
  breakdown: Record<string, unknown>;
};

type CandidateScores = {
  numericFitScore: Decimal | null;
  coverageRatio: Decimal;
  tagFitScore: Decimal | null;
  tagFitRaw: Decimal;
  tagFitScale: Decimal;
  contextFitScore: Decimal | null;
  contextLengthFit: Decimal | null;
  discoveryFitScore: Decimal | null;
  scoringMinimumConfidenceFactor: Decimal | null;
  riskPenalty: Decimal;
  riskPenaltyBreakdownJson: Prisma.InputJsonValue;
  finalScore: Decimal | null;
  recommendationEvidenceCoverage: Decimal;
  weightDistributionJson: Prisma.InputJsonValue;
  evaluationMetaJson: Prisma.InputJsonValue;
};

@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
  ) {}

  async scoreForFulfillment(fulfillmentId: string) {
    const fulfillment = await this.prisma.fulfillment.findUnique({
      where: { id: fulfillmentId },
      include: { order: { include: { user: { select: { id: true } } } } },
    });
    if (!fulfillment) throw new NotFoundException('No se encontró el fulfillment.');
    if (!fulfillment.order) throw new BadRequestException('El fulfillment no tiene un pedido válido.');

    const order = fulfillment.order;
    const productPackage = await this.prisma.productPackage.findUnique({ where: { key: order.packageKey } });
    if (!productPackage) throw new NotFoundException('No se encontró el paquete del pedido.');

    const profile = await this.profiles.ensureProfile(order.userId);
    const [dimensionRows, constraints, tagPreferences, tagEvidence, readerEvidence, conditionalRules, q03Answer, classifications] = await Promise.all([
      this.prisma.readerProfileDimension.findMany({ where: { profileId: profile.id } }),
      this.prisma.readerOperationalConstraints.findFirst({ where: { profileId: profile.id } }),
      this.prisma.readerTagPreference.findMany({ where: { profileId: profile.id } }),
      this.prisma.readerTagEvidence.findMany({ where: { profileId: profile.id, status: 'active' }, orderBy: { evidenceFingerprint: 'asc' } }),
      this.prisma.readerEvidence.findMany({ where: { profileId: profile.id, status: 'active' }, orderBy: { evidenceFingerprint: 'asc' } }),
      this.prisma.readerConditionalRule.findMany({ where: { profileId: profile.id } }),
      this.prisma.questionAnswer.findFirst({
        where: { userId: order.userId, questionKey: 'Q03_PRIORITY_RANKING' },
        orderBy: { answeredAt: 'desc' },
        select: { normalizedResponse: true },
      }),
      this.prisma.bookClassificationVersion.findMany({
        where: { status: 'approved' },
        include: {
          edition: { include: { book: { select: { id: true, canonicalTitle: true } } } },
          features: true,
          tags: true,
        },
      }),
    ]);

    const readerDimensions = dimensionRows.map<ReaderDimension>((row) => {
      const meta = DIMENSION_META.get(row.dimensionKey);
      return {
        dimensionKey: row.dimensionKey,
        bookFeatureKey: meta?.bookFeatureKey ?? null,
        dimensionKind: meta?.dimensionKind ?? 'target',
        matchingOperator: meta?.matchingOperator ?? MatchingOperator.absolute_distance,
        value: row.value,
        confidence: row.confidence,
      };
    });

    const userTags: UserTag[] = tagPreferences.map((preference) => ({
      tagKey: preference.tagKey,
      tagType: preference.tagType,
      affinity: preference.affinity,
      confidence: preference.confidence,
    }));

    const priority = this.resolvePriority(q03Answer?.normalizedResponse);
    const evidenceHash = evidenceSetHash(readerEvidence.map((item) => item.evidenceFingerprint));
    const tagEvidenceHash = evidenceSetHash(tagEvidence.map((item) => item.evidenceFingerprint));
    const priorityHash = priority ? priorityVectorHash({ ranking: [], priorityVector: priority }) : null;

    const acceptedLanguages = this.stringArray(constraints?.acceptedLanguagesJson);
    const minPages = constraints?.preferredPagesMin ?? null;
    const maxPages = constraints?.preferredPagesMax ?? null;

    const tagVersionByKey = new Map(
      (await this.prisma.tagVersion.findMany({ where: { tagKey: { in: [...new Set(classifications.flatMap((classification) => classification.tags.map((tag) => tag.tagKey)))] } } })).map((version) => [version.tagKey, version]),
    );

    const applicability = await this.prisma.bookFeatureApplicability.findMany();
    const requiredByType = new Map<string, string[]>();
    for (const row of applicability) {
      if (row.requirement !== 'required') continue;
      const key = `${row.featureSchemaVersion}|${row.contentTypeKey}|${row.contentTypeSchemaVersion}`;
      const list = requiredByType.get(key) ?? [];
      list.push(row.featureKey);
      requiredByType.set(key, list);
    }

    const slowBurnRule = conditionalRules.find((rule) => rule.ruleKey === 'slow_burn_compensators');

    const computed = classifications.flatMap((classification) => {
      const edition = classification.edition;
      if (acceptedLanguages.length > 0 && !acceptedLanguages.includes(edition.languageCode)) return [];
      if (minPages !== null && maxPages !== null) {
        if (edition.pages === null || edition.pages < minPages || edition.pages > maxPages) return [];
      }

      const features: BookFeatureMap = new Map(classification.features.map((feature) => [feature.featureKey, { value: feature.value, confidence: feature.confidence }]));
      const bookTags: BookTagSignal[] = classification.tags.map((tag) => {
        const version = tagVersionByKey.get(tag.tagKey);
        const deprecated = version?.status === 'deprecated';
        return {
          tagKey: tag.tagKey,
          tagType: version?.tagType ?? 'genre',
          strength: tag.strength,
          replacementTagKey: deprecated ? (version.replacementTagKey ?? null) : null,
        };
      });

      const numeric = numericFit(readerDimensions, features, priority);
      const tag = tagFit(userTags, bookTags);
      const length = lengthFit(edition.pages, minPages, maxPages);
      const discoveryFit: Decimal | null = null;
      const risk = this.riskFor(classification, features, requiredByType, readerDimensions, slowBurnRule?.ruleJson);

      const components = { numericFit: numeric.score, tagFit: tag.score, contextFit: length, discoveryFit };
      const final = finalScore(components, risk.total);
      const coverageValues = [numeric.score, tag.score, length, null, null, null, null, discoveryFit];
      const coverage = recommendationEvidenceCoverage(coverageValues);

      const isBlocked = numeric.score === null;
      const applicabilityKey = `${classification.featureSchemaVersion}|${classification.contentTypeKey}|${classification.contentTypeSchemaVersion}`;
      const requiredConfidences = (requiredByType.get(applicabilityKey) ?? [])
        .filter((featureKey) => features.has(featureKey))
        .map((featureKey) => features.get(featureKey)!.confidence);
      const coverageFactor = requiredConfidences.length
        ? round4(requiredConfidences.reduce((acc, confidence) => acc.plus(confidence), new Decimal(0)).div(requiredConfidences.length))
        : null;

      const scores: CandidateScores = {
        numericFitScore: numeric.score,
        coverageRatio: coverage,
        tagFitScore: tag.score,
        tagFitRaw: tag.raw,
        tagFitScale: tag.scale,
        contextFitScore: length,
        contextLengthFit: length,
        discoveryFitScore: discoveryFit,
        scoringMinimumConfidenceFactor: coverageFactor,
        riskPenalty: round4(risk.total),
        riskPenaltyBreakdownJson: risk.breakdown as Prisma.InputJsonValue,
        finalScore: final.score,
        recommendationEvidenceCoverage: coverage,
        weightDistributionJson: Object.fromEntries(Object.entries(final.weights).map(([key, value]) => [key, value.toFixed(4)])) as Prisma.InputJsonValue,
        evaluationMetaJson: {
          calculation_version: SCORING_CALCULATION_VERSION,
          classifier_version: classification.classifierVersion,
          tag_taxonomy_version: classification.tagTaxonomyVersion,
          profile_version: profile.currentVersion,
          evidence_set_hash: evidenceHash,
          tag_evidence_hash: tagEvidenceHash,
          priority_vector_hash: priorityHash,
          computed_at: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      };

      return [{
        classification,
        edition,
        scores,
        reviewStatus: isBlocked ? 'blocked' : 'eligible',
        blockReason: isBlocked ? 'numeric_no_eligible_dims' : null,
        explanation: {
          reasons: numeric.ewByDim.map((entry) => ({
            dimensionKey: entry.dimensionKey,
            reader: entry.readerValue.toNumber(),
            book: entry.bookValue.toNumber(),
            compatible: entry.compatibleValue.toNumber(),
            effectiveWeight: entry.effectiveWeight.toNumber(),
          })),
          tagMatches: tag.matches.map((match) => ({ tagKey: match.tagKey, affinity: match.affinity.toNumber(), strength: match.strength.toNumber() })),
          risk: risk.breakdown,
        },
      }];
    });

    computed.sort((a, b) => {
      const scoreA = a.scores.finalScore;
      const scoreB = b.scores.finalScore;
      if (scoreA && scoreB && !scoreA.equals(scoreB)) return scoreB.minus(scoreA).toNumber();
      const numericA = a.scores.numericFitScore;
      const numericB = b.scores.numericFitScore;
      if (numericA && numericB && !numericA.equals(numericB)) return numericB.minus(numericA).toNumber();
      return a.edition.title.localeCompare(b.edition.title);
    });

    const contextJson: Prisma.InputJsonValue = {
      package_key: order.packageKey,
      accepted_languages: acceptedLanguages,
      preferred_pages_min: minPages,
      preferred_pages_max: maxPages,
      calculation_version: SCORING_CALCULATION_VERSION,
    };

    const saved = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.recommendation.findFirst({ where: { fulfillmentId }, orderBy: { revision: 'desc' } });
      if (previous?.isCurrent) {
        await tx.recommendation.update({ where: { id: previous.id }, data: { isCurrent: false } });
      }
      const recommendation = await tx.recommendation.create({
        data: {
          fulfillmentId,
          revision: (previous?.revision ?? 0) + 1,
          userId: order.userId,
          profileId: profile.id,
          profileVersion: profile.currentVersion,
          packageKey: order.packageKey,
          contextJson,
          isCurrent: true,
        },
      });
      const candidates = [];
      for (const [index, entry] of computed.entries()) {
        const candidate = await tx.recommendationCandidate.create({
          data: {
            recommendationId: recommendation.id,
            bookEditionId: entry.edition.id,
            classificationVersionId: entry.classification.id,
            rankPosition: entry.reviewStatus === 'eligible' ? index + 1 : null,
            reviewStatus: entry.reviewStatus as CandidateReviewStatus,
            blockReason: entry.blockReason,
            ...entry.scores,
          },
        });
        candidates.push(candidate);
      }
      return { recommendation, candidates };
    });

    const ranked = computed.map((entry, index) => ({
      candidateId: saved.candidates[index]!.id,
      rankPosition: saved.candidates[index]!.rankPosition,
      bookEditionId: entry.edition.id,
      classificationVersionId: entry.classification.id,
      title: entry.edition.book.canonicalTitle,
      editionTitle: entry.edition.title,
      pages: entry.edition.pages,
      reviewStatus: entry.reviewStatus,
      blockReason: entry.blockReason,
      finalScore: entry.scores.finalScore?.toNumber() ?? null,
      numericFitScore: entry.scores.numericFitScore?.toNumber() ?? null,
      tagFitScore: entry.scores.tagFitScore?.toNumber() ?? null,
      contextFitScore: entry.scores.contextFitScore?.toNumber() ?? null,
      discoveryFitScore: entry.scores.discoveryFitScore?.toNumber() ?? null,
      riskPenalty: entry.scores.riskPenalty?.toNumber() ?? null,
      recommendationEvidenceCoverage: entry.scores.recommendationEvidenceCoverage?.toNumber() ?? null,
      explanation: entry.explanation,
    }));

    return {
      recommendation: {
        id: saved.recommendation.id,
        revision: saved.recommendation.revision,
        profileVersion: saved.recommendation.profileVersion,
        packageKey: saved.recommendation.packageKey,
      },
      candidates: ranked,
    };
  }

  private resolvePriority(normalizedResponse: Prisma.JsonValue | undefined): PriorityVector | null {
    if (!normalizedResponse || typeof normalizedResponse !== 'object' || Array.isArray(normalizedResponse)) return null;
    const record = normalizedResponse as Record<string, unknown>;
    if (record.priorityVector && typeof record.priorityVector === 'object') {
      return record.priorityVector as PriorityVector;
    }
    if (Array.isArray(record.ranking)) {
      try {
        return buildPriorityVector(record.ranking as Parameters<typeof buildPriorityVector>[0]);
      } catch {
        return null;
      }
    }
    return null;
  }

  private riskFor(
    classification: { featureSchemaVersion: string; contentTypeKey: string; contentTypeSchemaVersion: string },
    features: BookFeatureMap,
    requiredByType: Map<string, string[]>,
    readerDimensions: ReaderDimension[],
    slowBurnRuleJson: Prisma.JsonValue | null | undefined,
  ): RiskResult {
    const applicabilityKey = `${classification.featureSchemaVersion}|${classification.contentTypeKey}|${classification.contentTypeSchemaVersion}`;
    const requiredConfidences = (requiredByType.get(applicabilityKey) ?? [])
      .filter((featureKey) => features.has(featureKey))
      .map((featureKey) => features.get(featureKey)!.confidence);
    const coverage = coveragePenalty(requiredConfidences);

    const conditional: Array<{ rule_key: string; penalty: number }> = [];
    if (slowBurnRuleJson && typeof slowBurnRuleJson === 'object') {
      const rule = slowBurnRuleJson as unknown as SlowBurnCompensatorsRule;
      const readerSlowBurn = readerDimensions.find((dimension) => dimension.dimensionKey === 'slow_burn_tolerance')?.value ?? null;
      const bookFeatures: Record<string, number> = Object.fromEntries(
        [...features.entries()].map(([key, feature]) => [key, feature.value.toNumber()]),
      );
      const result = slowBurnRiskPenalty(
        rule,
        rule.compensators.map((compensator) => compensator.option_key),
        readerSlowBurn ? readerSlowBurn.toNumber() : null,
        bookFeatures,
      );
      if (result.riskPenalty > 0) conditional.push({ rule_key: 'slow_burn_compensators', penalty: result.riskPenalty });
    }
    const conditionalTotal = conditional.reduce((acc, entry) => acc.plus(entry.penalty), new Decimal(0));
    const total = Decimal.min(0.4, coverage.plus(conditionalTotal));
    return {
      total,
      breakdown: {
        coverage_penalty: coverage.toNumber(),
        soft_aversion_penalty: 0,
        conditional_rule_penalties: conditional,
        total: total.toNumber(),
      },
    };
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }
}
