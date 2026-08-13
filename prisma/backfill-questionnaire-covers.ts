import { Prisma, PrismaClient } from '@prisma/client';

const QUESTION_KEYS = ['Q01_LOVED_BOOKS', 'Q02_DISLIKED_BOOK'] as const;
const OPEN_LIBRARY_BASE = process.env.OPEN_LIBRARY_BASE_URL ?? 'https://openlibrary.org';
const REQUEST_DELAY_MS = 150;

type BookRecord = Record<string, unknown>;

function coverIdOf(book: BookRecord): number | null {
  const raw = book['cover_id'] ?? book['coverId'];
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null;
}

async function fetchCoverId(id: string, kind: 'editions' | 'works', cache: Map<string, number | null>): Promise<number | null> {
  if (cache.has(id)) return cache.get(id) ?? null;
  try {
    const response = await fetch(`${OPEN_LIBRARY_BASE}/${kind}/${encodeURIComponent(id)}.json`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { covers?: number[] };
    const cover = (json.covers ?? []).find((candidate) => Number.isInteger(candidate) && candidate > 0);
    return typeof cover === 'number' ? cover : null;
  } catch {
    return null;
  } finally {
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }
}

async function resolveCoverId(book: BookRecord, cache: Map<string, number | null>): Promise<number | null> {
  const editionId = typeof book['edition_id'] === 'string' && book['edition_id'] ? book['edition_id'] : null;
  if (editionId) {
    const coverId = await fetchCoverId(editionId, 'editions', cache);
    cache.set(editionId, coverId);
    if (coverId !== null) return coverId;
  }
  const workId = typeof book['work_id'] === 'string' && book['work_id'] ? book['work_id'] : null;
  if (workId) {
    if (cache.has(workId)) return cache.get(workId) ?? null;
    const coverId = await fetchCoverId(workId, 'works', cache);
    cache.set(workId, coverId);
    return coverId;
  }
  return null;
}

async function ensureCoverId(book: BookRecord, cache: Map<string, number | null>): Promise<void> {
  if (coverIdOf(book) !== null) return;
  book['cover_id'] = await resolveCoverId(book, cache);
}

export async function backfillQuestionnaireCovers(prisma: PrismaClient) {
  const answers = await prisma.questionAnswer.findMany({
    where: { questionKey: { in: [...QUESTION_KEYS] } },
    orderBy: { answeredAt: 'asc' },
    select: { id: true, questionKey: true, rawResponse: true, normalizedResponse: true },
  });
  const cache = new Map<string, number | null>();
  const summary = { answers: 0, books: 0, coversResolved: 0, coversMissing: 0 };

  for (const answer of answers) {
    const raw = answer.rawResponse as { books?: unknown } | null;
    const normalized = answer.normalizedResponse as { books?: unknown } | null;
    const rawBooks = Array.isArray(raw?.books) ? (raw.books as BookRecord[]) : [];
    const normalizedBooks = Array.isArray(normalized?.books) ? (normalized.books as BookRecord[]) : [];
    if (rawBooks.length === 0 && normalizedBooks.length === 0) continue;

    const seen = new Set<string>();
    for (const book of [...rawBooks, ...normalizedBooks]) {
      await ensureCoverId(book, cache);
      const workId = typeof book['work_id'] === 'string' ? book['work_id'] : null;
      const key = workId ?? JSON.stringify(book);
      if (seen.has(key)) continue;
      seen.add(key);
      summary.books += 1;
      if (coverIdOf(book) !== null) summary.coversResolved += 1;
      else summary.coversMissing += 1;
    }

    await prisma.questionAnswer.update({
      where: { id: answer.id },
      data: {
        rawResponse: raw as Prisma.InputJsonValue,
        normalizedResponse: normalized as Prisma.InputJsonValue,
      },
    });
    summary.answers += 1;
  }
  return summary;
}

if (process.argv[1]?.endsWith('backfill-questionnaire-covers.ts')) {
  const prisma = new PrismaClient();
  backfillQuestionnaireCovers(prisma)
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .finally(() => prisma.$disconnect());
}
