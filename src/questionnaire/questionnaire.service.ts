import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, QuestionDefinition, QuestionOptionMapping, ResponseType } from '@prisma/client';
import { isQuestionVisible, QUESTIONNAIRE_VERSION } from '../profile/catalog';
import { slowBurnCompensatorsRuleFor } from '../profile/conditional-rules';
import { EvidenceFactory, EvidenceInput } from '../profile/evidence.factory';
import { aggregateDimension, evidenceFingerprint, round } from '../profile/profile-calculation';
import { buildPriorityVector, PRIORITY_VECTOR_MAPPING_VERSION, PRIORITY_VECTOR_NORMALIZATION_METHOD, PriorityFactor, PriorityVector } from '../scoring/priority-vector';
import { deriveTagPreferences, tagEvidenceFingerprint } from '../feedback/feedback-tag-preferences';
import { AdminNotificationsService } from '../email/admin-notifications.service';
import { MetaCapiService } from '../meta/meta-capi.service';
import { ProfileDescriptionService } from '../profile/profile-description.service';
import { ProfileService } from '../profile/profile.service';
import { PrismaService } from '../prisma/prisma.service';

type Mapping = { dimensionKey?: string; observedValue?: number; observedValueFrom?: 'scale'; reasonCode: string; baseWeight: number; tagKey?: string; tagType?: string; affinity?: number; specificityFactor?: number; positiveTrigger?: string };
type QuestionWithOptions = QuestionDefinition & { optionMappings: QuestionOptionMapping[] };

@Injectable()
export class QuestionnaireService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
    private readonly evidenceFactory: EvidenceFactory,
    private readonly adminNotifications: AdminNotificationsService,
    private readonly descriptions: ProfileDescriptionService,
    private readonly meta: MetaCapiService,
  ) {}

  async reset(userId: string) {
    const profile = await this.profiles.ensureProfile(userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.questionnaireSession.deleteMany({ where: { userId } });
      await tx.readerTagPreference.deleteMany({ where: { profileId: profile.id } });
      await tx.readerOperationalConstraints.deleteMany({ where: { profileId: profile.id } });
      await tx.readerConditionalRule.deleteMany({ where: { profileId: profile.id } });
      await tx.readerPositiveTrigger.deleteMany({ where: { profileId: profile.id } });
      const questionnaireEvidence = await tx.readerEvidence.findMany({
        where: { profileId: profile.id, sourceType: 'questionnaire_answer' },
        select: { id: true },
      });
      const ids = questionnaireEvidence.map((item) => item.id);
      if (ids.length > 0) {
        await tx.readerEvidence.updateMany({ where: { supersededById: { in: ids } }, data: { supersededById: null } });
        await tx.readerEvidence.updateMany({ where: { id: { in: ids } }, data: { status: 'rejected', deactivatedAt: new Date() } });
      }
    });
    await this.invalidateAiDescription(userId);
    return this.profiles.recompute(userId, 'questionnaire_reset');
  }

  async invalidateAiDescription(userId: string): Promise<void> {
    const deferred = await this.descriptions.hasActiveFeedbackCycles(userId);
    await this.prisma.readerProfile.updateMany({
      where: { userId },
      data: { aiDescription: null, aiDescriptionStatus: deferred ? 'pending' : 'invalidated' },
    });
    if (!deferred) await this.descriptions.triggerGeneration(userId);
  }

  async listSessions(userId: string) {
    return this.prisma.questionnaireSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: { answers: { select: { id: true, questionKey: true, answeredAt: true }, orderBy: { answeredAt: 'asc' } } },
    });
  }

  async createSession(userId: string) {
    await this.profiles.ensureProfile(userId);
    const resumable = await this.prisma.questionnaireSession.findFirst({
      where: { userId, questionnaireVersion: QUESTIONNAIRE_VERSION, status: { in: ['started', 'abandoned'] } },
      orderBy: { startedAt: 'desc' },
    });
    if (resumable) return resumable;
    return this.prisma.questionnaireSession.create({ data: { userId, questionnaireVersion: QUESTIONNAIRE_VERSION } });
  }

  async nextQuestion(sessionId: string, userId: string) {
    const session = await this.prisma.questionnaireSession.findUnique({ where: { id: sessionId }, include: { answers: true } });
    if (!session) throw new NotFoundException('Questionnaire session not found.');
    this.assertSessionOwner(session.userId, userId);
    if (session.status !== 'started') return null;
    const answered = new Map(session.answers.map((answer) => [answer.questionKey, answer.normalizedResponse]));
    const visible = await this.visibleDefinitions(session, answered);
    const index = visible.findIndex((question) => !answered.has(question.questionKey));
    const next = index === -1 ? null : visible[index];
    if (!next) return null;
    return { ...this.publicQuestion(next), position: index + 1, totalQuestions: visible.length };
  }

  private async nextQuestionAfter(sessionId: string, questionKey: string, userId: string) {
    const session = await this.prisma.questionnaireSession.findUnique({ where: { id: sessionId }, include: { answers: true } });
    if (!session) throw new NotFoundException('Questionnaire session not found.');
    this.assertSessionOwner(session.userId, userId);
    if (session.status !== 'started') return null;
    const answered = new Map(session.answers.map((answer) => [answer.questionKey, answer.normalizedResponse]));
    const visible = await this.visibleDefinitions(session, answered);
    const index = visible.findIndex((question) => question.questionKey === questionKey);
    const next = index === -1 ? null : visible[index + 1];
    if (!next) return null;
    return { ...this.publicQuestion(next), position: index + 2, totalQuestions: visible.length };
  }

  async getQuestionWithResponse(sessionId: string, questionKey: string, userId: string) {
    const session = await this.prisma.questionnaireSession.findUnique({ where: { id: sessionId }, include: { answers: true } });
    if (!session) throw new NotFoundException('Questionnaire session not found.');
    this.assertSessionOwner(session.userId, userId);
    if (session.status !== 'started') throw new ConflictException('Questionnaire session is not active.');
    const question = await this.prisma.questionDefinition.findUnique({
      where: { questionKey_questionnaireVersion: { questionKey, questionnaireVersion: session.questionnaireVersion } },
      include: { optionMappings: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!question) throw new NotFoundException('Question is not defined for this session version.');
    const answered = new Map(session.answers.map((answer) => [answer.questionKey, answer.normalizedResponse]));
    const visible = await this.visibleDefinitions(session, answered);
    const index = visible.findIndex((item) => item.questionKey === questionKey);
    const answer = session.answers.find((item) => item.questionKey === questionKey);
    return {
      ...this.publicQuestion(question),
      position: index === -1 ? visible.length + 1 : index + 1,
      totalQuestions: visible.length,
      response: answer?.rawResponse ?? null,
    };
  }

  async submitAnswer(sessionId: string, questionKey: string, body: { response: unknown; stimulusHash?: string; idempotencyKey?: string }, userId: string) {
    const session = await this.prisma.questionnaireSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Questionnaire session not found.');
    this.assertSessionOwner(session.userId, userId);
    if (session.status !== 'started') throw new ConflictException('Questionnaire session is not active.');
    if (body.idempotencyKey) {
      const previous = await this.prisma.questionAnswer.findUnique({ where: { sessionId_idempotencyKey: { sessionId, idempotencyKey: body.idempotencyKey } } });
      if (previous) return { answer: previous, nextQuestion: await this.nextQuestionAfter(sessionId, questionKey, userId) };
    }
    const question = await this.prisma.questionDefinition.findUnique({
      where: { questionKey_questionnaireVersion: { questionKey, questionnaireVersion: session.questionnaireVersion } },
      include: { optionMappings: { where: { isActive: true } } },
    });
    if (!question) throw new NotFoundException('Question is not defined for this session version.');
    const normalized = this.normalize(question, body.response);
    const profile = await this.profiles.ensureProfile(session.userId);

    const answer = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.questionAnswer.findMany({ where: { sessionId, questionKey } });
      const previousIds = previous.map((answer) => answer.id);
      if (previousIds.length > 0) {
        await tx.readerEvidence.updateMany({ where: { supersededById: { in: previousIds } }, data: { supersededById: null } });
        await tx.readerEvidence.updateMany({ where: { sourceId: { in: previousIds } }, data: { status: 'rejected', deactivatedAt: new Date() } });
        await tx.readerPositiveTriggerEvidence.deleteMany({ where: { sourceId: { in: previousIds } } });
        await tx.readerConditionalRule.deleteMany({ where: { sourceId: { in: previousIds } } });
        await tx.questionAnswer.deleteMany({ where: { sessionId, questionKey } });
      }
      const created = await tx.questionAnswer.create({
        data: {
          sessionId,
          userId: session.userId,
          questionKey,
          questionVersion: question.version,
          questionnaireVersion: session.questionnaireVersion,
          stimulusHash: body.stimulusHash ?? null,
          rawResponse: body.response as Prisma.InputJsonValue,
          normalizedResponse: normalized as Prisma.InputJsonValue,
          idempotencyKey: body.idempotencyKey ?? null,
        },
      });
      const mappings = this.resolveMappings(question, normalized);
      if (mappings.length > 0) {
        await this.evidenceFactory.createMany(tx, {
          userId: session.userId,
          profileId: profile.id,
          sourceType: 'questionnaire_answer',
          sourceId: created.id,
          evidence: mappings,
        });
      }
      await this.applyTagPreferences(tx, profile.id, question.questionKey, normalized, created.id);
      await this.applyOperationalConstraints(tx, profile.id, question.questionKey, normalized);
      await this.createConditionalRules(tx, profile.id, created.id, question.questionKey, normalized);
      await this.createPositiveTriggers(tx, profile.id, created.id, question, normalized);
      await tx.readerPositiveTrigger.deleteMany({ where: { evidence: { none: {} } } });
      if (question.questionKey === 'Q01_LOVED_BOOKS' && normalized.skipped !== true) {
        const q02Answers = await tx.questionAnswer.findMany({ where: { sessionId, questionKey: 'Q02_DISLIKED_BOOK' }, select: { id: true, normalizedResponse: true } });
        const skippedQ02Ids = q02Answers
          .filter((q02) => {
            const response = q02.normalizedResponse as { skipped?: boolean } | null;
            return response !== null && typeof response === 'object' && response.skipped === true;
          })
          .map((q02) => q02.id);
        if (skippedQ02Ids.length > 0) {
          await tx.questionAnswer.deleteMany({ where: { id: { in: skippedQ02Ids } } });
        }
      }
      return created;
    });
    return { answer, nextQuestion: await this.nextQuestionAfter(sessionId, questionKey, userId) };
  }

  async completeSession(sessionId: string, userId: string) {
    const session = await this.prisma.questionnaireSession.findUnique({ where: { id: sessionId }, include: { answers: true } });
    if (!session) throw new NotFoundException('Questionnaire session not found.');
    this.assertSessionOwner(session.userId, userId);
    const required = await this.prisma.questionDefinition.findMany({ where: { questionnaireVersion: session.questionnaireVersion, isActive: true, isRequired: true }, select: { questionKey: true } });
    const answered = new Set(session.answers.map((answer) => answer.questionKey));
    const answeredMap = new Map(session.answers.map((answer) => [answer.questionKey, answer.normalizedResponse]));
    const missing = required.filter((question) => isQuestionVisible(question.questionKey, answeredMap) && !answered.has(question.questionKey)).map((question) => question.questionKey);
    if (missing.length > 0) throw new BadRequestException({ message: 'Required questions are missing.', missing });
    const priorCompletion = await this.prisma.readerProfileVersion.findFirst({
      where: { profile: { userId: session.userId }, changeReason: 'questionnaire_completed' },
      select: { id: true },
    });
    const completed = await this.prisma.questionnaireSession.update({ where: { id: sessionId }, data: { status: 'completed', completedAt: new Date(), optimisticLockVersion: { increment: 1 } } });
    await this.profiles.recompute(session.userId, 'questionnaire_completed', completed.id);
    if (await this.descriptions.hasActiveFeedbackCycles(session.userId)) {
      await this.prisma.readerProfile.updateMany({ where: { userId: session.userId }, data: { aiDescriptionStatus: 'pending' } });
    } else {
      await this.descriptions.triggerGeneration(session.userId);
    }
    if (!priorCompletion) {
      await this.adminNotifications.notifyNewReader(session.userId);
      this.sendRegistrationEvent(session.userId, completed.id);
    }
    return completed;
  }

  private sendRegistrationEvent(userId: string, sessionId: string): void {
    void this.prisma.user
      .findUnique({ where: { id: userId }, select: { email: true } })
      .then((user) => this.meta.sendEvent({
        eventName: 'CompleteRegistration',
        eventId: `questionnaire:${sessionId}`,
        userData: { email: user?.email ?? null, externalId: userId },
        customData: { status: true },
      }))
      .catch(() => undefined);
  }

  private normalize(question: QuestionWithOptions, response: unknown): Record<string, unknown> {
    if (response !== null && typeof response === 'object' && !Array.isArray(response) && (response as Record<string, unknown>).skipped === true) {
      if (question.isRequired) throw new BadRequestException('Esta pregunta es obligatoria y no se puede omitir.');
      return { skipped: true };
    }
    if (question.responseType === ResponseType.scale) {
      if (typeof response !== 'number' || !Number.isInteger(response) || response < 1 || response > 5) throw new BadRequestException('A scale response must be an integer from 1 to 5.');
      return { value: (response - 1) / 4 };
    }
    if (question.responseType === ResponseType.single_select) {
      const optionKey = typeof response === 'string' ? response : this.readString(response, 'optionKey');
      if (!question.optionMappings.some((option) => option.optionKey === optionKey)) throw new BadRequestException('Unknown option.');
      return { optionKeys: [optionKey] };
    }
    if (question.responseType === ResponseType.multi_select) {
      const optionKeys = Array.isArray(response) ? response : this.readStrings(response, 'optionKeys');
      if (optionKeys.length === 0 || !optionKeys.every((key) => question.optionMappings.some((option) => option.optionKey === key))) throw new BadRequestException('One or more options are unknown.');
      const validation = question.validationJson as { maxItems?: number } | null;
      if (validation?.maxItems && optionKeys.length > validation.maxItems) throw new BadRequestException(`A maximum of ${validation.maxItems} options is allowed.`);
      return { optionKeys: [...new Set(optionKeys)] };
    }
    if (question.responseType === ResponseType.ranking) {
      const ranking = Array.isArray(response) ? response : this.readStrings(response, 'ranking');
      const validation = question.validationJson as { allowed?: string[]; maxItems?: number } | null;
      if (ranking.length !== 3 || new Set(ranking).size !== ranking.length || !ranking.every((item) => validation?.allowed?.includes(item))) throw new BadRequestException('Ranking must contain three distinct allowed values.');
      let priorityVector: PriorityVector;
      try {
        priorityVector = buildPriorityVector(ranking as PriorityFactor[]);
      } catch (error) {
        throw new BadRequestException(error instanceof Error ? error.message : 'Ranking is invalid.');
      }
      return { ranking, priorityVector, normalizationMethod: PRIORITY_VECTOR_NORMALIZATION_METHOD, mappingVersion: PRIORITY_VECTOR_MAPPING_VERSION };
    }
    if (response === null || typeof response !== 'object' || Array.isArray(response)) throw new BadRequestException('A structured response must be an object.');
    if (question.responseType === ResponseType.book_search) return this.normalizeBookSearch(question, response as Record<string, unknown>);
    if (question.questionKey === 'Q15_ADDITIONAL_COMMENTS') {
      const comment = (response as Record<string, unknown>)['comment'];
      if (comment !== undefined && comment !== null && typeof comment !== 'string') throw new BadRequestException('El comentario adicional debe ser texto.');
      const trimmed = typeof comment === 'string' ? comment.trim() : '';
      if (trimmed.length > 2000) throw new BadRequestException('El comentario adicional debe tener hasta 2000 caracteres.');
      return trimmed ? { comment: trimmed } : { skipped: true };
    }
    if (question.questionKey === 'Q07_COMPLEXITY') {
      return { linguistic: this.readScaleValue(response, 'linguistic'), structural: this.readScaleValue(response, 'structural') };
    }
    if (question.questionKey === 'Q11_GENRES_THEMES') return this.normalizeTagSelections(response as Record<string, unknown>);
    if (question.questionKey === 'Q12_LENGTH_SERIES') return this.normalizeLengthSeries(response as Record<string, unknown>);
    if (question.questionKey === 'Q13_FORMAT_LANGUAGE') return this.normalizeLanguages(response as Record<string, unknown>);
    return response as Record<string, unknown>;
  }

  private assertSessionOwner(sessionUserId: string, userId: string) {
    if (sessionUserId !== userId) throw new ForbiddenException('No tienes acceso a este cuestionario.');
  }

  private resolveMappings(question: QuestionWithOptions, normalized: Record<string, unknown>): EvidenceInput[] {
    if (normalized.skipped === true) return [];
    if (question.questionKey === 'Q03_PRIORITY_RANKING') return [];
    if (question.questionKey === 'Q07_COMPLEXITY') {
      return [
        { dimensionKey: 'linguistic_complexity_tolerance', observedValue: this.readNumber(normalized, 'linguistic'), reasonCode: 'q07_linguistic_complexity', baseWeight: 0.6, rawPayload: { question_key: question.questionKey, normalized_response: normalized } },
        { dimensionKey: 'structural_complexity_tolerance', observedValue: this.readNumber(normalized, 'structural'), reasonCode: 'q07_structural_complexity', baseWeight: 0.6, rawPayload: { question_key: question.questionKey, normalized_response: normalized } },
      ];
    }
    const selected = question.responseType === ResponseType.scale ? question.optionMappings : question.optionMappings.filter((option) => this.readStrings(normalized, 'optionKeys').includes(option.optionKey));
    return selected.flatMap((option) => (option.evidenceMappingsJson as Mapping[]).flatMap((mapping) => {
      if (!mapping.dimensionKey) return [];
      const observedValue = mapping.observedValueFrom === 'scale' ? this.readNumber(normalized, 'value') : mapping.observedValue;
      if (observedValue === undefined) return [];
      return [{ dimensionKey: mapping.dimensionKey, observedValue, reasonCode: mapping.reasonCode, baseWeight: mapping.baseWeight, specificityFactor: mapping.specificityFactor, rawPayload: { questionnaire_version: question.questionnaireVersion, question_key: question.questionKey, option_key: option.optionKey, normalized_response: normalized } }];
    }));
  }

  private async applyTagPreferences(tx: Prisma.TransactionClient, profileId: string, questionKey: string, normalized: Record<string, unknown>, sourceId: string) {
    const requested = questionKey === 'Q11_GENRES_THEMES' ? this.tagSelections(normalized) : [];
    if (questionKey === 'Q11_GENRES_THEMES') {
      const profile = await tx.readerProfile.findUniqueOrThrow({ where: { id: profileId }, select: { userId: true } });
      await tx.readerTagEvidence.updateMany({
        where: { profileId, sourceType: 'questionnaire' },
        data: { status: 'rejected' },
      });
      for (const preference of requested) {
        const tag = await tx.tagVersion.findFirst({ where: { tagKey: preference.tagKey, taxonomicVersion: 'tag-tax/1.0.1', status: 'active' } });
        if (!tag) throw new BadRequestException(`Unknown or inactive tag: ${preference.tagKey}.`);
        const adjustment = preference.affinity;
        const rawPayload = { questionnaire_version: QUESTIONNAIRE_VERSION, question_key: 'Q11_GENRES_THEMES', tag_key: preference.tagKey, affinity: preference.affinity };
        const fingerprint = tagEvidenceFingerprint('questionnaire', sourceId, preference.tagKey, 'q11_initial', adjustment, rawPayload);
        await tx.readerTagEvidence.upsert({
          where: { sourceType_sourceId_tagKey_reasonCode: { sourceType: 'questionnaire', sourceId, tagKey: preference.tagKey, reasonCode: 'q11_initial' } },
          create: {
            userId: profile.userId,
            profileId,
            sourceType: 'questionnaire',
            sourceId,
            tagKey: preference.tagKey,
            adjustment,
            direction: adjustment < 0 ? -1 : 1,
            baseWeight: 1,
            finalWeight: 1,
            reasonCode: 'q11_initial',
            mappingVersion: 'questionnaire-tag/1.0',
            rawPayload: rawPayload as Prisma.InputJsonValue,
            evidenceFingerprint: fingerprint,
            status: 'active',
          },
          update: { adjustment, evidenceFingerprint: fingerprint },
        });
      }
      await deriveTagPreferences(tx, profileId);
    }
  }

  private tagSelections(normalized: Record<string, unknown>): Array<{ tagKey: string; affinity: number }> {
    return [
      ...this.readStrings(normalized, 'liked').map((tagKey) => ({ tagKey, affinity: 0.8 })),
      ...this.readStrings(normalized, 'curious').map((tagKey) => ({ tagKey, affinity: 0.45 })),
      ...this.readStrings(normalized, 'notInterested').map((tagKey) => ({ tagKey, affinity: -0.4 })),
    ];
  }

  private normalizeTagSelections(response: Record<string, unknown>): Record<string, string[]> {
    const normalize = (property: string, maxItems?: number) => {
      const tags = [...new Set(this.readStrings(response, property).map((tagKey) => tagKey.trim()).filter(Boolean))];
      if (maxItems && tags.length > maxItems) throw new BadRequestException(`A maximum of ${maxItems} tags is allowed for ${property}.`);
      return tags;
    };
    const normalized = {
      liked: normalize('liked', 5),
      curious: normalize('curious', 3),
      notInterested: normalize('notInterested'),
    };
    if (!normalized.liked.length) throw new BadRequestException('Select at least one tag you like.');
    if (!normalized.curious.length) throw new BadRequestException('Select at least one tag you are curious about.');
    return normalized;
  }

  private normalizeLengthSeries(response: Record<string, unknown>): { minPages: number; maxPages: number; seriesPreference: string } {
    const minPages = response['minPages'];
    const maxPages = response['maxPages'];
    const seriesPreference = response['seriesPreference'];
    if (typeof minPages !== 'number' || typeof maxPages !== 'number' || !Number.isInteger(minPages) || !Number.isInteger(maxPages) || minPages <= 0 || minPages > maxPages) throw new BadRequestException('Page limits must be positive integers with minPages less than or equal to maxPages.');
    if (typeof seriesPreference !== 'string' || !['standalone_only', 'standalone_preferred', 'no_preference'].includes(seriesPreference)) throw new BadRequestException('Unknown series preference.');
    return { minPages, maxPages, seriesPreference };
  }

  private normalizeLanguages(response: Record<string, unknown>): { languages: string[]; acceptedFormats: string[]; formatSource: 'user_selected' | 'product_default' } {
    const languageCodes: Record<string, string> = { spanish: 'es', english: 'en', es: 'es', en: 'en' };
    const languages = [...new Set(this.readStrings(response, 'languages').map((language) => languageCodes[language.trim()]).filter((language): language is string => Boolean(language)))];
    if (!languages.length || !this.readStrings(response, 'languages').every((language) => language.trim() in languageCodes)) {
      throw new BadRequestException('Select Spanish, English, or both.');
    }
    const requestedFormats = [...new Set(this.readStrings(response, 'acceptedFormats').concat(this.readStrings(response, 'formats')).map((format) => format.trim()).filter(Boolean))];
    if (requestedFormats.length && !requestedFormats.every((format) => format === 'physical')) throw new BadRequestException('Only physical books are available in this MVP.');
    return { languages, acceptedFormats: requestedFormats.length ? requestedFormats : ['physical'], formatSource: requestedFormats.length ? 'user_selected' : 'product_default' };
  }

  private async visibleDefinitions(session: { questionnaireVersion: string }, answered: Map<string, Prisma.JsonValue>): Promise<QuestionWithOptions[]> {
    const definitions = await this.prisma.questionDefinition.findMany({
      where: { questionnaireVersion: session.questionnaireVersion, isActive: true },
      include: { optionMappings: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { displayOrder: 'asc' },
    });
    return definitions.filter((question) => this.isVisible(question, answered));
  }

  private isVisible(question: QuestionDefinition, answered: Map<string, Prisma.JsonValue>): boolean {
    return isQuestionVisible(question.questionKey, answered);
  }

  private publicQuestion(question: QuestionWithOptions) {
    return { questionKey: question.questionKey, version: question.version, text: question.textEsMx, responseType: question.responseType, isRequired: question.isRequired, validation: question.validationJson, options: question.optionMappings.map((option) => ({ key: option.optionKey, label: option.labelEsMx })) };
  }

  private normalizeBookSearch(question: QuestionWithOptions, response: Record<string, unknown>): Record<string, unknown> {
    const books = response['books'];
    if (Array.isArray(books) && books.length > 0) {
      const validation = question.validationJson as { minItems?: number; maxItems?: number } | null;
      const maxItems = validation?.maxItems ?? (question.questionKey === 'Q02_DISLIKED_BOOK' ? 20 : Number.MAX_SAFE_INTEGER);
      if (books.length > maxItems) throw new BadRequestException(`A maximum of ${maxItems} books is allowed for ${question.questionKey}.`);
      const minItems = validation?.minItems ?? 0;
      if (books.length < minItems) throw new BadRequestException(`A minimum of ${minItems} books is required for ${question.questionKey}.`);
      const normalized = books.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new BadRequestException(`Book at index ${index} must be an object.`);
        const book = item as Record<string, unknown>;
        const openLibraryId = book['work_id'] ?? book['openLibraryId'];
        if (typeof openLibraryId !== 'string' || !openLibraryId.trim()) throw new BadRequestException(`Book at index ${index} is missing openLibraryId.`);
        if (question.questionnaireVersion === QUESTIONNAIRE_VERSION) {
          const editionId = book['edition_id'] ?? book['openLibraryEditionId'];
          const rawCoverId = book['cover_id'] ?? book['coverId'];
          if (rawCoverId !== undefined && rawCoverId !== null && (typeof rawCoverId !== 'number' || !Number.isInteger(rawCoverId) || rawCoverId <= 0)) throw new BadRequestException(`Book at index ${index} has invalid cover_id.`);
          const coverId = typeof rawCoverId === 'number' ? rawCoverId : null;
          const freeText = book['free_text'];
          if (freeText !== undefined && freeText !== null && typeof freeText !== 'string') throw new BadRequestException(`Book at index ${index} has invalid free_text.`);
          const rating = this.readBookRating(book, index);
          if (question.questionKey === 'Q01_LOVED_BOOKS') {
            const likedAspects = this.readStrings(book, 'liked_aspects');
            if (!likedAspects.length || !likedAspects.every((aspect) => ['characters', 'prose', 'originality', 'ending', 'emotions', 'universe'].includes(aspect))) throw new BadRequestException(`Book at index ${index} requires at least one valid liked_aspect.`);
            return { work_id: openLibraryId.trim(), edition_id: typeof editionId === 'string' ? editionId : null, cover_id: coverId, rating, liked_aspects: [...new Set(likedAspects)], free_text: freeText?.trim() || null };
          }
          const reasonCodes = this.readStrings(book, 'reason_codes').length ? this.readStrings(book, 'reason_codes') : this.readStrings(response, 'reason_codes');
          if (!reasonCodes.length || !reasonCodes.every((code) => ['too_conceptually_dense', 'too_slow', 'too_confusing', 'too_long', 'not_engaging', 'other'].includes(code))) throw new BadRequestException(`Book at index ${index} requires at least one valid reason_code.`);
          const responseFreeText = typeof response['free_text'] === 'string' ? response['free_text'] : response['reason'];
          if (responseFreeText !== undefined && responseFreeText !== null && typeof responseFreeText !== 'string') throw new BadRequestException('Book-search free_text must be a string or null.');
          return { work_id: openLibraryId.trim(), edition_id: typeof editionId === 'string' ? editionId : null, cover_id: coverId, rating, reason_codes: [...new Set(reasonCodes)], free_text: (typeof freeText === 'string' ? freeText : responseFreeText)?.trim() || null };
        }
        const title = book['title'];
        if (typeof title !== 'string' || !title.trim()) throw new BadRequestException(`Book at index ${index} is missing title.`);
        const authors = Array.isArray(book['authors']) && book['authors'].every((author) => typeof author === 'string') ? book['authors'] as string[] : [];
        const firstPublishYear = typeof book['firstPublishYear'] === 'number' ? book['firstPublishYear'] : null;
        const coverUrl = typeof book['coverUrl'] === 'string' ? book['coverUrl'] : null;
        return { openLibraryId: openLibraryId.trim(), title: title.trim(), authors, firstPublishYear, coverUrl };
      });
      const reason = response['reason'];
      if (reason !== undefined && (typeof reason !== 'string' && reason !== null)) throw new BadRequestException('Book-search reason must be a string or null.');
      return reason === undefined ? { books: normalized } : { books: normalized, reason: reason?.trim() || null };
    }
    const titles = response['titles'];
    if (Array.isArray(titles) && titles.every((item) => typeof item === 'string')) return { titles: titles.filter((item) => item.trim()) };
    throw new BadRequestException(`A book_search response must contain a non-empty "books" array (or legacy "titles").`);
  }

  private readString(value: unknown, property: string): string {
    if (!value || typeof value !== 'object' || Array.isArray(value) || typeof (value as Record<string, unknown>)[property] !== 'string') throw new BadRequestException(`Expected ${property}.`);
    return (value as Record<string, string>)[property]!;
  }

  private readStrings(value: unknown, property: string): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const candidate = (value as Record<string, unknown>)[property];
    return Array.isArray(candidate) && candidate.every((item) => typeof item === 'string') ? candidate : [];
  }

  private readNumber(value: Record<string, unknown>, property: string): number {
    const candidate = value[property];
    if (typeof candidate !== 'number') throw new BadRequestException(`Expected numeric ${property}.`);
    return candidate;
  }

  private readBookRating(book: Record<string, unknown>, index: number): number {
    const candidate = book['rating'];
    if (typeof candidate !== 'number' || !Number.isInteger(candidate) || candidate < 1 || candidate > 5) throw new BadRequestException(`Book at index ${index} requires a rating from 1 to 5.`);
    return candidate;
  }

  private readScaleValue(value: unknown, property: string): number {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException(`Expected ${property}.`);
    const raw = (value as Record<string, unknown>)[property];
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 5) throw new BadRequestException(`${property} must be an integer from 1 to 5.`);
    return (raw - 1) / 4;
  }

  private async applyOperationalConstraints(tx: Prisma.TransactionClient, profileId: string, questionKey: string, normalized: Record<string, unknown>) {
    if (questionKey !== 'Q12_LENGTH_SERIES' && questionKey !== 'Q13_FORMAT_LANGUAGE') return;
    const data = questionKey === 'Q12_LENGTH_SERIES'
      ? { preferredPagesMin: this.readNumber(normalized, 'minPages'), preferredPagesMax: this.readNumber(normalized, 'maxPages'), seriesPreference: this.readString(normalized, 'seriesPreference') }
      : { acceptedLanguagesJson: this.readStrings(normalized, 'languages'), acceptedFormatsJson: this.readStrings(normalized, 'acceptedFormats'), formatSource: this.readString(normalized, 'formatSource') };
    await tx.readerOperationalConstraints.upsert({ where: { profileId }, create: { profileId, ...data }, update: data });
  }

  private async createConditionalRules(tx: Prisma.TransactionClient, profileId: string, sourceId: string, questionKey: string, normalized: Record<string, unknown>) {
    if (questionKey !== 'Q05A_SLOW_BURN_CONDITIONS') return;
    const selected = this.readStrings(normalized, 'optionKeys');
    const rule = slowBurnCompensatorsRuleFor(selected);
    await tx.readerConditionalRule.upsert({
      where: { profileId_sourceId_ruleKey: { profileId, sourceId, ruleKey: rule.rule_key } },
      create: { profileId, sourceId, ruleKey: rule.rule_key, ruleJson: rule as Prisma.InputJsonValue },
      update: {},
    });
  }

  private async createPositiveTriggers(tx: Prisma.TransactionClient, profileId: string, sourceId: string, question: QuestionWithOptions, normalized: Record<string, unknown>) {
    const selected = question.optionMappings.filter((option) => this.readStrings(normalized, 'optionKeys').includes(option.optionKey));
    for (const option of selected) {
      for (const mapping of option.evidenceMappingsJson as Mapping[]) {
        if (!mapping.positiveTrigger) continue;
        const trigger = await tx.readerPositiveTrigger.upsert({
          where: { profileId_triggerKey: { profileId, triggerKey: mapping.positiveTrigger } },
          create: { profileId, triggerKey: mapping.positiveTrigger },
          update: {},
        });
        const rawPayload = { questionnaire_version: question.questionnaireVersion, question_key: question.questionKey, option_key: option.optionKey, normalized_response: normalized };
        const finalWeight = round(mapping.baseWeight * (mapping.specificityFactor ?? 1));
        const fingerprint = evidenceFingerprint(sourceId, mapping.positiveTrigger, mapping.reasonCode, 1, rawPayload);
        await tx.readerPositiveTriggerEvidence.upsert({
          where: { evidenceFingerprint: fingerprint },
          create: { triggerId: trigger.id, sourceId, baseWeight: mapping.baseWeight, exposureFactor: 1, specificityFactor: mapping.specificityFactor ?? 1, attributionFactor: 1, finalWeight, reasonCode: mapping.reasonCode, rawPayload: rawPayload as Prisma.InputJsonValue, evidenceFingerprint: fingerprint },
          update: {},
        });
        const evidence = await tx.readerPositiveTriggerEvidence.findMany({ where: { triggerId: trigger.id } });
        const aggregate = aggregateDimension(evidence.map((item) => ({ dimensionKey: mapping.positiveTrigger!, observedValue: 1, finalWeight: item.finalWeight, sourceType: 'questionnaire_answer', sourceId: item.sourceId, createdAt: item.createdAt })));
        await tx.readerPositiveTrigger.update({ where: { id: trigger.id }, data: { confidence: aggregate.confidence, evidenceCount: aggregate.evidenceCount, totalEvidenceWeight: aggregate.totalEvidenceWeight } });
      }
    }
  }
}
