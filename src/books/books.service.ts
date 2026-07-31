import { Injectable, GatewayTimeoutException } from '@nestjs/common';

export type BookResult = {
  openLibraryId: string;
  openLibraryEditionId: string | null;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  coverUrl: string | null;
};

type OpenLibraryDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  editions?: {
    docs?: Array<{
      key: string;
      title: string;
      cover_i?: number;
    }>;
  };
};

type OpenLibraryResponse = {
  docs?: OpenLibraryDoc[];
};

type CacheEntry = { results: BookResult[]; expiresAt: number };

const DEFAULT_BASE = 'https://openlibrary.org';
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_SIZE = 200;

@Injectable()
export class BooksService {
  private readonly base = process.env.OPEN_LIBRARY_BASE_URL ?? DEFAULT_BASE;
  private readonly cache = new Map<string, CacheEntry>();

  async search(query: string, limit = 8): Promise<BookResult[]> {
    const normalized = query.trim();
    if (!normalized) return [];
    const cappedLimit = Math.min(Math.max(limit, 1), 20);
    const cacheKey = `${normalized.toLowerCase()}|${cappedLimit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.results;
    const searchQuery = this.prefixSearchQuery(normalized);
    const url = `${this.base}/search.json?q=${encodeURIComponent(searchQuery)}&_spellcheck_count=0&limit=${cappedLimit}&fields=key,cover_i,ia,title,subtitle,author_name,author_key,first_publish_year,ebook_access,language,editions`;
    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch {
      throw new GatewayTimeoutException('Open Library is not reachable.');
    }
    if (!response.ok) throw new GatewayTimeoutException(`Open Library responded with status ${response.status}.`);
    const json = (await response.json()) as OpenLibraryResponse;
    const results: BookResult[] = (json.docs ?? []).map((doc) => {
      const edition = doc.editions?.docs?.[0];
      const coverId = edition?.cover_i ?? doc.cover_i;
      return {
        openLibraryId: doc.key.replace(/^\/works\//, ''),
        openLibraryEditionId: edition?.key.replace(/^\/books\//, '') ?? null,
        title: edition?.title ?? doc.title,
        authors: doc.author_name ?? [],
        firstPublishYear: doc.first_publish_year ?? null,
        coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null,
      };
    });
    this.setCache(cacheKey, results);
    return results;
  }

  private setCache(key: string, results: BookResult[]): void {
    if (this.cache.size >= CACHE_MAX_SIZE) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }
    this.cache.set(key, { results, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private prefixSearchQuery(query: string): string {
    const terms = query.split(/\s+/);
    const last = terms.at(-1)!;
    return last.length >= 3 && !last.endsWith('*') ? `${terms.slice(0, -1).join(' ')}${terms.length > 1 ? ' ' : ''}${last}*` : query;
  }
}
