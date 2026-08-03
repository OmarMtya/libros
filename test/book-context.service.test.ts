import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookContextService } from '../src/ai/book-context.service';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const notOk = () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response;

describe('BookContextService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_BOOKS_API_KEY;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    delete process.env.GOOGLE_BOOKS_API_KEY;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.GOOGLE_BOOKS_API_KEY = originalKey;
  });

  it('builds a labeled block from OpenLibrary subjects and description', async () => {
    fetchMock.mockResolvedValueOnce(
      ok({
        'ISBN:9788498381498': {
          title: 'El Principito',
          subjects: [{ name: 'fantasy' }, { name: 'friendship' }, { name: 'love' }],
          subjects_people: [{ name: 'El Principito' }],
          subjects_places: [{ name: 'Desierto del Sahara' }],
          description: { value: 'Un piloto varado conoce a un pequeño príncipe…' },
        },
      }),
    );
    const service = new BookContextService();
    const block = await service.buildBlock({ isbn: '9788498381498' });

    expect(block).toContain('Fuente: OpenLibrary (metadatos públicos).');
    expect(block).toContain('Temas/clasificaciones: fantasy, friendship, love');
    expect(block).toContain('Personajes: El Principito');
    expect(block).toContain('Lugares: Desierto del Sahara');
    expect(block).toContain('Sinopsis: Un piloto varado');
    expect(fetchMock.mock.calls[0]![0]).toContain('ISBN:9788498381498');
  });

  it('adds a Google Books block when the API key is configured', async () => {
    process.env.GOOGLE_BOOKS_API_KEY = 'test-key';
    fetchMock
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(
        ok({
          items: [
            {
              volumeInfo: {
                title: 'El Principito',
                categories: ['Fiction', 'Fantasy'],
                pageCount: 96,
                averageRating: 4.6,
                ratingsCount: 120,
                description: 'El relato del aviador y el niño de otro planeta.',
              },
            },
          ],
        }),
      );
    const service = new BookContextService();
    const block = await service.buildBlock({ isbn: '9788498381498' });

    expect(block).toContain('Fuente: Google Books (ficha editorial).');
    expect(block).toContain('Categorías: Fiction, Fantasy');
    expect(block).toContain('Páginas: 96');
    expect(block).toContain('Rating medio: 4.6/5 (120 valoraciones)');
    expect(block).toContain('Sinopsis editorial:');
    expect(fetchMock.mock.calls[1]![0]).toContain('key=test-key');
  });

  it('returns an empty block when sources are unavailable', async () => {
    fetchMock.mockResolvedValueOnce(notOk());
    const service = new BookContextService();
    await expect(service.buildBlock({ isbn: '9788498381498' })).resolves.toBe('');
  });

  it('skips OpenLibrary when there is no ISBN and returns empty without a Google key', async () => {
    const service = new BookContextService();
    await expect(service.buildBlock({ canonicalTitle: 'Sin ISBN' })).resolves.toBe('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caps the block length to avoid bloating the prompt', async () => {
    const longDescription = 'x'.repeat(20_000);
    fetchMock.mockResolvedValueOnce(
      ok({
        'ISBN:9788498381498': { subjects: [{ name: 'love' }], description: longDescription },
      }),
    );
    const service = new BookContextService();
    const block = await service.buildBlock({ isbn: '9788498381498' });

    expect(block.length).toBeLessThanOrEqual(12_100);
    expect(block.endsWith('…')).toBe(true);
  });
});
