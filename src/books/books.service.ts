import { Injectable, GatewayTimeoutException } from '@nestjs/common';

export type BookResult = {
  openLibraryId: string;
  openLibraryEditionId: string | null;
  title: string;
  authors: string[];
  firstPublishYear: number | null;
  coverUrl: string | null;
  originalLanguage: string;
};

export type BookEditionDetail = {
  openLibraryEditionId: string;
  title: string;
  languageCode: string;
  pages: number | null;
  publisher: string | null;
  publicationYear: number | null;
  isbn: string | null;
  coverUrl: string | null;
};

type OpenLibraryDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  language?: string[];
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

const OL_LANGUAGE_TO_BCP47: Record<string, string> = {
  spa: 'es', eng: 'en', por: 'pt', fra: 'fr', ger: 'de', ita: 'it', dut: 'nl', rus: 'ru',
  jpn: 'ja', chi: 'zh', zho: 'zh', ara: 'ar', kor: 'ko', pol: 'pl', tur: 'tr', swe: 'sv',
  dan: 'da', nor: 'no', fin: 'fi', ces: 'cs', hun: 'hu', heb: 'he', hin: 'hi', ben: 'bn',
  vie: 'vi', tha: 'th', ind: 'id', ukr: 'uk', cat: 'ca', eus: 'eu', glg: 'gl', lat: 'la',
  grc: 'el', ell: 'el', srp: 'sr', hrv: 'hr', bul: 'bg', ron: 'ro', slv: 'sl', lit: 'lt',
  lvs: 'lv', est: 'et', msa: 'ms', tgl: 'tl', urd: 'ur', fas: 'fa', swa: 'sw',
  deu: 'de', fre: 'fr', per: 'fa',
};

function olLanguageToBcp47(code: string | undefined): string {
  if (!code) return 'es';
  return OL_LANGUAGE_TO_BCP47[code.toLowerCase()] ?? 'es';
}

@Injectable()
export class BooksService {
  private readonly base = process.env.OPEN_LIBRARY_BASE_URL ?? DEFAULT_BASE;
  private readonly cache = new Map<string, CacheEntry>();

  async search(query: string, limit = 8): Promise<BookResult[]> {
    const normalized = query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
        originalLanguage: olLanguageToBcp47(doc.language?.[0]),
      };
    });
    this.setCache(cacheKey, results);
    return results;
  }

  async fetchEdition(openLibraryEditionId: string): Promise<BookEditionDetail | null> {
    const id = openLibraryEditionId.replace(/^\/books\//, '');
    if (!id) return null;
    const url = `${this.base}/books/${encodeURIComponent(id)}.json`;
    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch {
      throw new GatewayTimeoutException('Open Library is not reachable.');
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new GatewayTimeoutException(`Open Library responded with status ${response.status}.`);
    const json = (await response.json()) as {
      title?: string;
      languages?: Array<{ key?: string }>;
      publishers?: string[];
      number_of_pages?: number;
      publish_date?: string;
      isbn_13?: string[];
      isbn_10?: string[];
      covers?: number[];
    };
    return {
      openLibraryEditionId: id,
      title: json.title ?? '',
      languageCode: olLanguageToBcp47(json.languages?.[0]?.key?.replace(/^\/languages\//, '')),
      pages: json.number_of_pages ?? null,
      publisher: json.publishers?.[0] ?? null,
      publicationYear: json.publish_date ? Number.parseInt(json.publish_date.match(/\b(19|20)\d{2}\b/)?.[0] ?? '', 10) || null : null,
      isbn: json.isbn_13?.[0] ?? json.isbn_10?.[0] ?? null,
      coverUrl: json.covers?.[0] ? `https://covers.openlibrary.org/b/id/${json.covers[0]}-M.jpg` : null,
    };
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
