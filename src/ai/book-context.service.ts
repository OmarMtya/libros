import { Injectable, Logger } from '@nestjs/common';

export type BookContextInput = {
  isbn?: string | null;
  canonicalTitle?: string;
  authors?: string[];
  languageCode?: string;
};

const MAX_BLOCK_CHARS = 12_000;
const TIMEOUT_MS = 5_000;

type OpenLibraryData = {
  title?: string;
  subjects?: Array<{ name: string }>;
  subjects_people?: Array<{ name: string }>;
  subjects_places?: Array<{ name: string }>;
  description?: string | { value?: string } | null;
};

type GoogleBookVolume = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    categories?: string[];
    description?: string;
    averageRating?: number;
    ratingsCount?: number;
    pageCount?: number;
  };
};

@Injectable()
export class BookContextService {
  private readonly logger = new Logger(BookContextService.name);
  private readonly googleApiKey = process.env.GOOGLE_BOOKS_API_KEY ?? '';

  async buildBlock(input: BookContextInput): Promise<string> {
    const blocks: string[] = [];

    const openLibrary = await this.fetchOpenLibrary(input).catch((error: unknown) => {
      this.logger.warn(`OpenLibrary falló: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    });
    if (openLibrary) blocks.push(openLibrary);

    if (this.googleApiKey) {
      const google = await this.fetchGoogleBooks(input).catch((error: unknown) => {
        this.logger.warn(`Google Books falló: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });
      if (google) blocks.push(google);
    }

    if (blocks.length === 0) return '';
    let block = blocks.join('\n\n');
    if (block.length > MAX_BLOCK_CHARS) block = `${block.slice(0, MAX_BLOCK_CHARS)}\n…`;
    return block;
  }

  private async fetchOpenLibrary(input: BookContextInput): Promise<string | null> {
    if (!input.isbn) return null;
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(input.isbn)}&format=json&jscmd=data`;
    const response = await this.get(url);
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, OpenLibraryData>;
    const book = data[`ISBN:${input.isbn}`];
    if (!book) return null;

    const lines: string[] = [];
    const subjects = dedupe((book.subjects ?? []).map((subject) => subject.name)).slice(0, 25);
    const people = dedupe((book.subjects_people ?? []).map((subject) => subject.name)).slice(0, 10);
    const places = dedupe((book.subjects_places ?? []).map((subject) => subject.name)).slice(0, 10);
    if (subjects.length) lines.push(`Temas/clasificaciones: ${subjects.join(', ')}`);
    if (people.length) lines.push(`Personajes: ${people.join(', ')}`);
    if (places.length) lines.push(`Lugares: ${places.join(', ')}`);
    const description = typeof book.description === 'string' ? book.description : book.description?.value;
    if (description?.trim()) lines.push(`Sinopsis: ${description.trim()}`);
    if (lines.length === 0) return null;
    return `Fuente: OpenLibrary (metadatos públicos).\n${lines.join('\n')}`;
  }

  private async fetchGoogleBooks(input: BookContextInput): Promise<string | null> {
    const query = input.isbn
      ? `q=isbn:${encodeURIComponent(input.isbn)}`
      : `q=intitle:${encodeURIComponent(input.canonicalTitle ?? '')}${input.authors?.length ? `+inauthor:${encodeURIComponent(input.authors[0]!)}` : ''}`;
    const url = `https://www.googleapis.com/books/v1/volumes?${query}&key=${encodeURIComponent(this.googleApiKey)}`;
    const response = await this.get(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { items?: GoogleBookVolume[] };
    const volume = data.items?.[0]?.volumeInfo;
    if (!volume) return null;

    const lines: string[] = [];
    if (volume.categories?.length) lines.push(`Categorías: ${volume.categories.join(', ')}`);
    if (volume.pageCount) lines.push(`Páginas: ${volume.pageCount}`);
    if (typeof volume.averageRating === 'number') lines.push(`Rating medio: ${volume.averageRating}/5 (${volume.ratingsCount ?? 0} valoraciones)`);
    if (volume.description?.trim()) lines.push(`Sinopsis editorial: ${volume.description.trim()}`);
    if (lines.length === 0) return null;
    return `Fuente: Google Books (ficha editorial).\n${lines.join('\n')}`;
  }

  private async get(url: string): Promise<Response> {
    return fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  }
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(value.trim());
  }
  return result;
}
