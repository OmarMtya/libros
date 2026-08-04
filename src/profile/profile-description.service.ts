import { Injectable, Logger } from '@nestjs/common';
import { DeepseekClient } from '../ai/deepseek.client';
import { PrismaService } from '../prisma/prisma.service';
import { AiDescriptionProfileInput, buildProfileDescriptionPrompt } from './ai-description.prompt';

const MAX_DESCRIPTION_CHARS = 400;

@Injectable()
export class ProfileDescriptionService {
  private readonly logger = new Logger(ProfileDescriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deepseek: DeepseekClient,
  ) {}

  async generate(userId: string): Promise<{ status: 'ready' | 'pending'; description: string | null }> {
    try {
      const input = await this.buildInput(userId);
      const { system, user } = buildProfileDescriptionPrompt(input);
      const text = await this.deepseek.chatText({ system, user });
      const description = this.trimToMax(text);
      if (!description) {
        this.logger.warn(`Descripción de IA vacía para el usuario ${userId}. texto crudo (${text.length} chars).`);
        await this.prisma.readerProfile.updateMany({ where: { userId }, data: { aiDescriptionStatus: 'pending' } });
        return { status: 'pending', description: null };
      }
      await this.prisma.readerProfile.updateMany({
        where: { userId },
        data: { aiDescription: description, aiDescriptionStatus: 'ready', aiDescriptionGeneratedAt: new Date() },
      });
      this.logger.log(`Descripción de IA generada para el usuario ${userId} (${description.length} chars).`);
      return { status: 'ready', description };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`No se pudo generar la descripción de IA para el usuario ${userId}: ${message}`, error instanceof Error ? error.stack : undefined);
      await this.prisma.readerProfile.updateMany({ where: { userId }, data: { aiDescriptionStatus: 'pending' } });
      return { status: 'pending', description: null };
    }
  }

  async ensureGeneration(userId: string): Promise<void> {
    const completed = await this.prisma.questionnaireSession.findFirst({ where: { userId, status: 'completed' }, select: { id: true } });
    if (!completed) return;
    const current = await this.prisma.readerProfile.findUnique({ where: { userId }, select: { aiDescription: true, aiDescriptionStatus: true } });
    if (!current || current.aiDescription || current.aiDescriptionStatus === 'generating') return;
    if (current.aiDescriptionStatus === 'pending' && (await this.hasActiveFeedbackCycles(userId))) return;
    const claimed = await this.prisma.readerProfile.updateMany({
      where: { userId, aiDescription: null, aiDescriptionStatus: { not: 'generating' } },
      data: { aiDescriptionStatus: 'generating' },
    });
    if (claimed.count === 1) void this.generate(userId);
  }

  async generateNow(userId: string): Promise<void> {
    const claimed = await this.prisma.readerProfile.updateMany({
      where: { userId, aiDescriptionStatus: { not: 'generating' } },
      data: { aiDescriptionStatus: 'generating' },
    });
    if (claimed.count === 1) void this.generate(userId);
  }

  async triggerGeneration(userId: string): Promise<void> {
    const claimed = await this.prisma.readerProfile.updateMany({
      where: { userId, aiDescriptionStatus: { not: 'generating' } },
      data: { aiDescriptionStatus: 'generating' },
    });
    if (claimed.count === 1) void this.generate(userId);
  }

  async hasActiveFeedbackCycles(userId: string): Promise<boolean> {
    const pendingFeedback = await this.prisma.readingFeedback.count({
      where: { userId, learningStatus: { in: ['pending_processing', 'needs_review'] } },
    });
    if (pendingFeedback > 0) return true;
    const openCycle = await this.prisma.curationAssignment.count({
      where: { feedbackCycleStatus: { in: ['invited', 'provisional_received'] }, fulfillment: { order: { userId } } },
    });
    return openCycle > 0;
  }

  private async buildInput(userId: string): Promise<AiDescriptionProfileInput> {
    const profile = await this.prisma.readerProfile.findUniqueOrThrow({
      where: { userId },
      include: {
        dimensions: true,
        tagPreferences: true,
        operationalConstraints: true,
        user: { select: { displayName: true } },
      },
    });
    const tagKeys = profile.tagPreferences.map((preference) => preference.tagKey);
    const tagNames = new Map<string, string>();
    if (tagKeys.length > 0) {
      const versions = await this.prisma.tagVersion.findMany({
        where: { tagKey: { in: tagKeys }, status: 'active' },
        select: { tagKey: true, name: true },
      });
      for (const version of versions) if (!tagNames.has(version.tagKey)) tagNames.set(version.tagKey, version.name);
    }
    const [priorityRanking, lovedFromQuestionnaire, dislikedFromQuestionnaire, feedbackBooks] = await Promise.all([
      this.loadPriorityRanking(userId),
      this.loadBookTitles('Q01_LOVED_BOOKS', userId),
      this.loadBookTitles('Q02_DISLIKED_BOOK', userId),
      this.loadFeedbackBooks(userId),
    ]);
    return {
      displayName: profile.user.displayName,
      priorityRanking,
      dimensions: profile.dimensions.map((dimension) => ({
        key: dimension.dimensionKey,
        value: dimension.value != null ? dimension.value.toNumber() : null,
        confidence: dimension.confidence.toNumber(),
      })),
      tagPreferences: profile.tagPreferences.map((preference) => ({
        tagKey: preference.tagKey,
        name: tagNames.get(preference.tagKey) ?? preference.tagKey,
        affinity: preference.affinity.toNumber(),
      })),
      constraints: profile.operationalConstraints
        ? {
            preferredPagesMin: profile.operationalConstraints.preferredPagesMin,
            preferredPagesMax: profile.operationalConstraints.preferredPagesMax,
            seriesPreference: profile.operationalConstraints.seriesPreference,
            acceptedLanguages: this.stringArray(profile.operationalConstraints.acceptedLanguagesJson),
            acceptedFormats: this.stringArray(profile.operationalConstraints.acceptedFormatsJson),
          }
        : undefined,
      lovedBooks: [...lovedFromQuestionnaire, ...feedbackBooks.enjoyed],
      dislikedBooks: [...dislikedFromQuestionnaire, ...feedbackBooks.disliked],
    };
  }

  private async loadPriorityRanking(userId: string): Promise<string[] | undefined> {
    const answer = await this.prisma.questionAnswer.findFirst({
      where: { userId, questionKey: 'Q03_PRIORITY_RANKING' },
      orderBy: { answeredAt: 'desc' },
      select: { normalizedResponse: true },
    });
    const normalized = answer?.normalizedResponse as { ranking?: unknown } | null;
    return Array.isArray(normalized?.ranking) ? normalized.ranking.filter((item): item is string => typeof item === 'string') : undefined;
  }

  private async loadBookTitles(questionKey: string, userId: string): Promise<Array<{ title: string; authors: string[] }>> {
    const answers = await this.prisma.questionAnswer.findMany({
      where: { userId, questionKey },
      orderBy: { answeredAt: 'desc' },
      select: { rawResponse: true },
    });
    const books: Array<{ title: string; authors: string[] }> = [];
    for (const answer of answers) {
      const raw = answer.rawResponse as { books?: Array<{ title?: unknown; authors?: unknown }> } | null;
      for (const book of raw?.books ?? []) {
        if (typeof book?.title !== 'string' || !book.title.trim()) continue;
        books.push({
          title: book.title.trim(),
          authors: Array.isArray(book.authors) ? book.authors.filter((item): item is string => typeof item === 'string') : [],
        });
      }
    }
    return books;
  }

  private async loadFeedbackBooks(userId: string): Promise<{ enjoyed: Array<{ title: string; authors: string[] }>; disliked: Array<{ title: string; authors: string[] }> }> {
    const feedbacks = await this.prisma.readingFeedback.findMany({
      where: { userId },
      select: {
        selectionFitRating: true,
        readingStatus: true,
        edition: {
          select: {
            book: {
              select: {
                canonicalTitle: true,
                authors: { include: { author: { select: { canonicalName: true } } }, orderBy: { position: 'asc' } },
              },
            },
          },
        },
      },
    });
    const enjoyed: Array<{ title: string; authors: string[] }> = [];
    const disliked: Array<{ title: string; authors: string[] }> = [];
    for (const feedback of feedbacks) {
      const book = feedback.edition?.book;
      if (!book) continue;
      const entry = { title: book.canonicalTitle, authors: book.authors.map((item) => item.author.canonicalName) };
      const liked = feedback.selectionFitRating != null ? feedback.selectionFitRating >= 4 : feedback.readingStatus === 'completed';
      const notLiked = feedback.selectionFitRating != null ? feedback.selectionFitRating <= 2 : feedback.readingStatus === 'abandoned' || feedback.readingStatus === 'not_started';
      if (liked) enjoyed.push(entry);
      else if (notLiked) disliked.push(entry);
    }
    return { enjoyed, disliked };
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private trimToMax(value: string): string | null {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    if (!cleaned) return null;
    if (cleaned.length <= MAX_DESCRIPTION_CHARS) return cleaned;
    const slice = cleaned.slice(0, MAX_DESCRIPTION_CHARS);
    let cut = -1;
    for (const marker of ['. ', '; ', ', ', '— ', ': ']) {
      const idx = slice.lastIndexOf(marker);
      if (idx >= MAX_DESCRIPTION_CHARS * 0.5 && idx > cut) cut = idx + 1;
    }
    if (cut === -1) {
      const lastSpace = slice.lastIndexOf(' ');
      cut = lastSpace > MAX_DESCRIPTION_CHARS * 0.6 ? lastSpace : slice.length;
    }
    return slice.slice(0, cut).trim();
  }
}
