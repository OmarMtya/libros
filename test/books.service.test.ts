import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BooksService } from '../src/books/books.service';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

describe('BooksService', () => {
  let service: BooksService;
  const fetchMock = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    service = new BooksService();
    fetchMock.mockReset();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('uses Open Library general search and its matching edition', async () => {
    fetchMock.mockResolvedValueOnce(ok({
      docs: [{
        key: '/works/OL19096402W',
        title: 'The Silent Patient',
        author_name: ['Alex Michaelides'],
        first_publish_year: 2018,
        cover_i: 9407338,
        editions: { docs: [{ key: '/books/OL47457228M', title: 'La pacient silenciosa', cover_i: 15242046 }] },
      }],
    }));
    const results = await service.search('la paciente silenciosa', 8);
    expect(results).toEqual([{ openLibraryId: 'OL19096402W', openLibraryEditionId: 'OL47457228M', title: 'La pacient silenciosa', authors: ['Alex Michaelides'], firstPublishYear: 2018, coverUrl: 'https://covers.openlibrary.org/b/id/15242046-M.jpg' }]);
    expect(fetchMock.mock.calls[0]![0]!).toContain('q=la%20paciente%20silenciosa*');
    expect(fetchMock.mock.calls[0]![0]!).toContain('_spellcheck_count=0');
    expect(fetchMock.mock.calls[0]![0]!).toContain('editions');
    expect(fetchMock.mock.calls[0]![0]!).not.toContain('title=');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the work metadata when no matching edition is returned', async () => {
    fetchMock.mockResolvedValueOnce(ok({ docs: [{ key: '/works/OL278437W', title: 'La sombra del viento', author_name: ['Carlos Ruiz Zafón'], first_publish_year: 2001, cover_i: 10107644 }] }));
    const results = await service.search('sombra viento', 8);
    expect(results).toEqual([{ openLibraryId: 'OL278437W', openLibraryEditionId: null, title: 'La sombra del viento', authors: ['Carlos Ruiz Zafón'], firstPublishYear: 2001, coverUrl: 'https://covers.openlibrary.org/b/id/10107644-M.jpg' }]);
  });

  it('adds a prefix wildcard to the final partial term', async () => {
    fetchMock.mockResolvedValueOnce(ok({ docs: [] }));
    await service.search('la pacien', 8);
    expect(fetchMock.mock.calls[0]![0]!).toContain('q=la%20pacien*');
  });

  it('returns cached results on a second identical call without fetching', async () => {
    fetchMock.mockResolvedValueOnce(ok({ docs: [] }));
    await service.search('cache-me', 8);
    const results = await service.search('cache-me', 8);
    expect(results).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws GatewayTimeoutException when Open Library is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(service.search('anything')).rejects.toThrowError(/not reachable/);
  });

  it('throws GatewayTimeoutException on non-ok status', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as unknown as Response);
    await expect(service.search('anything')).rejects.toThrowError(/status 503/);
  });

  it('returns empty array for empty query', async () => {
    const results = await service.search('   ');
    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
