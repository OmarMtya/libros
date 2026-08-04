import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PublicBook = {
  title: string;
  authors: string[];
  coverUrl: string | null;
  review?: {
    readingStatus: string;
    selectionFitRating: number | null;
    started: boolean;
    completionPercentage: number;
    notStartedReason: string | null;
    outcomeAttribution: string | null;
    positiveAspects: string[];
    negativeAspects: string[];
    freeText: string | null;
  } | null;
};

@Injectable()
export class PublicProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(slug: string, viewerUserId: string | null = null) {
    const profile = await this.prisma.readerProfile.findUnique({
      where: { publicSlug: slug },
      include: {
        user: {
          select: {
            displayName: true,
            avatarUrl: true,
            questionnaireSessions: { where: { status: 'completed' }, select: { id: true }, take: 1 },
          },
        },
        tagPreferences: true,
        operationalConstraints: true,
      },
    });
    if (!profile) throw new NotFoundException('Perfil no encontrado.');
    const isOwner = viewerUserId != null && viewerUserId === profile.userId;
    if (profile.user.questionnaireSessions.length === 0) {
      if (isOwner) {
        return {
          notReady: true,
          slug: profile.publicSlug,
          displayName: profile.user.displayName,
          avatarUrl: profile.user.avatarUrl,
          isOwner: true,
          aiDescription: null,
          aiDescriptionStatus: 'none',
          aiDescriptionGeneratedAt: null,
          categories: { liked: [], curious: [], notInterested: [] },
          constraints: null,
          books: { enjoyed: [], notEnjoyed: [] },
          currentlyReading: null,
        };
      }
      throw new NotFoundException('Perfil no encontrado.');
    }

    const categories = await this.categories(profile.tagPreferences);
    const [books, currentlyReading] = await Promise.all([this.books(profile.userId), this.currentlyReading(profile.userId)]);
    return {
      slug: profile.publicSlug,
      displayName: profile.user.displayName,
      avatarUrl: profile.user.avatarUrl,
      isOwner,
      aiDescription: profile.aiDescription,
      aiDescriptionStatus: profile.aiDescriptionStatus,
      aiDescriptionGeneratedAt: profile.aiDescriptionGeneratedAt,
      categories,
      constraints: this.constraints(profile.operationalConstraints),
      books,
      currentlyReading,
    };
  }

  private async currentlyReading(userId: string): Promise<{ title: string | null; author: string | null; coverUrl: string | null } | null> {
    const order = await this.prisma.order.findFirst({
      where: { userId, fulfillment: { isNot: null } },
      orderBy: { createdAt: 'desc' },
      select: {
        _count: { select: { feedbacks: true } },
        fulfillment: {
          select: {
            status: true,
            bookTitle: true,
            bookAuthor: true,
            coverUrl: true,
            assignments: {
              where: { status: 'active' },
              select: {
                feedbackCycleStatus: true,
                edition: {
                  select: {
                    title: true,
                    book: {
                      select: {
                        canonicalTitle: true,
                        openLibraryCoverId: true,
                        authors: { include: { author: { select: { canonicalName: true } } }, orderBy: { position: 'asc' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    const fulfillment = order?.fulfillment;
    if (!fulfillment || fulfillment.status === 'canceled' || fulfillment.status !== 'delivered') return null;
    const feedbackDone = (order?._count.feedbacks ?? 0) > 0
      || fulfillment.assignments.some(
        (assignment) => assignment.feedbackCycleStatus === 'final_received' || assignment.feedbackCycleStatus === 'closed_without_feedback',
      );
    if (feedbackDone) return null;
    const edition = fulfillment.assignments[0]?.edition ?? null;
    const book = edition?.book ?? null;
    const authors = (book?.authors ?? []).map(({ author }) => author.canonicalName);
    return {
      title: fulfillment.bookTitle ?? book?.canonicalTitle ?? edition?.title ?? null,
      author: fulfillment.bookAuthor ?? (authors.length > 0 ? authors.join(', ') : null),
      coverUrl: fulfillment.coverUrl ?? (book?.openLibraryCoverId != null ? `https://covers.openlibrary.org/b/id/${book.openLibraryCoverId}-L.jpg` : null),
    };
  }

  private async categories(tagPreferences: Array<{ tagKey: string; affinity: Prisma.Decimal }>) {
    const keys = tagPreferences.map((preference) => preference.tagKey);
    const names = new Map<string, string>();
    if (keys.length > 0) {
      const versions = await this.prisma.tagVersion.findMany({
        where: { tagKey: { in: keys }, status: 'active' },
        select: { tagKey: true, name: true },
      });
      for (const version of versions) if (!names.has(version.tagKey)) names.set(version.tagKey, version.name);
    }
    const item = (preference: { tagKey: string; affinity: Prisma.Decimal }) => ({
      key: preference.tagKey,
      label: names.get(preference.tagKey) ?? preference.tagKey,
    });
    return {
      liked: tagPreferences.filter((preference) => preference.affinity.toNumber() >= 0.8).map(item),
      curious: tagPreferences.filter((preference) => preference.affinity.toNumber() > 0 && preference.affinity.toNumber() < 0.8).map(item),
      notInterested: tagPreferences.filter((preference) => preference.affinity.toNumber() < 0).map(item),
    };
  }

  private constraints(constraints: {
    preferredPagesMin: number | null;
    preferredPagesMax: number | null;
    seriesPreference: string | null;
    acceptedLanguagesJson: Prisma.JsonValue;
    acceptedFormatsJson: Prisma.JsonValue;
  } | null) {
    if (!constraints) return null;
    return {
      preferredPagesMin: constraints.preferredPagesMin,
      preferredPagesMax: constraints.preferredPagesMax,
      seriesPreference: constraints.seriesPreference,
      languages: this.stringArray(constraints.acceptedLanguagesJson),
      formats: this.stringArray(constraints.acceptedFormatsJson),
    };
  }

  private async books(userId: string): Promise<{ enjoyed: PublicBook[]; notEnjoyed: PublicBook[] }> {
    const [questionnaireAnswers, feedbacks] = await Promise.all([
      this.prisma.questionAnswer.findMany({
        where: { userId, questionKey: { in: ['Q01_LOVED_BOOKS', 'Q02_DISLIKED_BOOK'] } },
        orderBy: { answeredAt: 'asc' },
        select: { questionKey: true, rawResponse: true },
      }),
      this.prisma.readingFeedback.findMany({
        where: { userId },
        orderBy: { submittedAt: 'desc' },
        select: {
          started: true,
          notStartedReason: true,
          readingStatus: true,
          completionPercentage: true,
          selectionFitRating: true,
          outcomeAttribution: true,
          freeText: true,
          aspects: { select: { polarity: true, optionKey: true } },
          edition: {
            select: {
              title: true,
              book: {
                select: {
                  canonicalTitle: true,
                  openLibraryCoverId: true,
                  authors: { include: { author: { select: { canonicalName: true } } }, orderBy: { position: 'asc' } },
                },
              },
            },
          },
        },
      }),
    ]);

    const enjoyed: PublicBook[] = [];
    const notEnjoyed: PublicBook[] = [];
    const seen = new Set<string>();

    const pushQuestionnaireBooks = (questionKey: string, destination: PublicBook[]) => {
      for (const answer of questionnaireAnswers.filter((item) => item.questionKey === questionKey)) {
        const raw = answer.rawResponse as { books?: Array<{ title?: unknown; authors?: unknown }> } | null;
        for (const book of raw?.books ?? []) {
          if (typeof book?.title !== 'string' || !book.title.trim()) continue;
          const title = book.title.trim();
          const key = title.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          destination.push({
            title,
            authors: Array.isArray(book.authors) ? book.authors.filter((item): item is string => typeof item === 'string') : [],
            coverUrl: null,
            review: null,
          });
        }
      }
    };

    for (const feedback of feedbacks) {
      const book = feedback.edition?.book;
      if (!book) continue;
      const title = book.canonicalTitle;
      const key = title.toLowerCase();
      const coverUrl = book.openLibraryCoverId != null ? `https://covers.openlibrary.org/b/id/${book.openLibraryCoverId}-L.jpg` : null;
      const review = {
        readingStatus: feedback.readingStatus,
        selectionFitRating: feedback.selectionFitRating,
        started: feedback.started,
        completionPercentage: feedback.completionPercentage,
        notStartedReason: feedback.notStartedReason,
        outcomeAttribution: feedback.outcomeAttribution,
        positiveAspects: feedback.aspects.filter((aspect) => aspect.polarity === 'positive').map((aspect) => aspect.optionKey),
        negativeAspects: feedback.aspects.filter((aspect) => aspect.polarity === 'negative').map((aspect) => aspect.optionKey),
        freeText: feedback.freeText,
      };
      const entry: PublicBook = { title, authors: book.authors.map((item) => item.author.canonicalName), coverUrl, review };
      const liked = feedback.selectionFitRating != null ? feedback.selectionFitRating >= 4 : feedback.readingStatus === 'completed';
      const notLiked = feedback.selectionFitRating != null ? feedback.selectionFitRating <= 2 : feedback.readingStatus === 'abandoned' || feedback.readingStatus === 'not_started';
      const destination = liked ? enjoyed : notLiked ? notEnjoyed : null;
      if (!destination) continue;
      if (seen.has(key)) {
        const existing = [...enjoyed, ...notEnjoyed].find((item) => item.title.toLowerCase() === key);
        if (existing && !existing.review && review) existing.review = review;
        continue;
      }
      seen.add(key);
      destination.push(entry);
    }

    pushQuestionnaireBooks('Q01_LOVED_BOOKS', enjoyed);
    pushQuestionnaireBooks('Q02_DISLIKED_BOOK', notEnjoyed);
    return { enjoyed, notEnjoyed };
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }
}
