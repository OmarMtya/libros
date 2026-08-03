import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookClassificationAiService } from '../src/ai/book-classification-ai.service';
import { DeepseekClient } from '../src/ai/deepseek.client';
import { buildClassificationUserMessage, truncateMarkdown } from '../src/ai/book-classification-prompt';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

const draft = {
  id: 'class-1',
  bookEditionId: 'edition-1',
  status: 'draft',
  contentTypeKey: 'fiction',
  contentTypeSchemaVersion: 'content-types/1.0',
  featureSchemaVersion: 'book-features/1.0',
  tagTaxonomyVersion: 'tag-tax/1.0.1',
  edition: {
    id: 'edition-1',
    title: 'La sombra del viento',
    languageCode: 'es',
    publisher: 'Booket',
    publicationYear: 2016,
    book: {
      canonicalTitle: 'La sombra del viento',
      originalLanguage: 'es',
      authors: [{ author: { canonicalName: 'Carlos Ruiz Zafón' } }],
    },
  },
};

const applicability = [
  { featureKey: 'hook_speed', requirement: 'required' },
  { featureKey: 'narrative_pace', requirement: 'required' },
  { featureKey: 'character_depth', requirement: 'required' },
  { featureKey: 'worldbuilding_load', requirement: 'not_applicable' },
];

const activeTags = [
  { tagKey: 'science_fiction' },
  { tagKey: 'identity' },
  { tagKey: 'love' },
];

function makeService(chatJson: ReturnType<typeof vi.fn>) {
  const prisma = {
    bookClassificationVersion: {
      findUnique: vi.fn().mockResolvedValue(draft),
    },
    bookFeatureApplicability: {
      findMany: vi.fn().mockResolvedValue(applicability),
    },
    tagVersion: {
      findMany: vi.fn().mockResolvedValue(activeTags),
    },
  };
  const deepseek = { chatJson };
  const bookContext = { buildBlock: vi.fn().mockResolvedValue('') };
  const service = new BookClassificationAiService(prisma as never, deepseek as never, bookContext as never);
  return { service, prisma, bookContext };
}

describe('BookClassificationAiService', () => {
  it('caps confidence at 0.95 and preserves values below the cap', async () => {
    const chatJson = vi.fn().mockResolvedValue({
      features: {
        hook_speed: { value: 0.85, confidence: 0.82 },
        character_depth: { value: 0.72, confidence: 0.97 },
        worldbuilding_load: { value: 0.9, confidence: 0.8 },
        unknown_feature: { value: 1, confidence: 0.5 },
        narrative_pace: { value: 0.4, confidence: 0.3 },
      },
      tags: {
        science_fiction: { strength: 0.9, confidence: 0.82 },
        love: { strength: 0.6, confidence: 0.3 },
        no_existe: { strength: 0.5, confidence: 0.4 },
      },
    });
    const { service } = makeService(chatJson);

    const proposal = await service.proposeFromMarkdown('class-1', '# Capítulo 1\nTexto del libro…');

    expect(proposal.contentTypeKey).toBe('fiction');
    expect(proposal.features).toEqual({
      hook_speed: { value: 0.85, confidence: 0.82 },
      character_depth: { value: 0.72, confidence: 0.95 },
      narrative_pace: { value: 0.4, confidence: 0.3 },
    });
    expect(proposal.tags).toEqual({
      science_fiction: { strength: 0.9, confidence: 0.82 },
      love: { strength: 0.6, confidence: 0.3 },
    });
    expect(proposal.featureSchemaVersion).toBe('book-features/1.0');
    expect(proposal.tagTaxonomyVersion).toBe('tag-tax/1.0.1');
  });

  it('clamps out-of-range values and backfills missing applicable features with a neutral low-confidence value', async () => {
    const chatJson = vi.fn().mockResolvedValue({
      features: {
        hook_speed: { value: 1.5, confidence: 0.5 },
        narrative_pace: { value: -0.2, confidence: 0.3 },
        unknown_feature: { value: 0.5, confidence: 0.3 },
      },
      tags: { science_fiction: { strength: 2, confidence: 0.2 } },
    });
    const { service } = makeService(chatJson);

    const proposal = await service.proposeFromMarkdown('class-1', '# Capítulo 1');

    expect(proposal.features.hook_speed!.value).toBe(1);
    expect(proposal.features.narrative_pace!.value).toBe(0);
    expect(proposal.features.unknown_feature).toBeUndefined();
    expect(proposal.features.character_depth).toEqual({ value: 0.5, confidence: 0.15 });
    expect(proposal.tags.science_fiction!.strength).toBe(1);
  });

  it('rejects proposals when the classification is not a draft', async () => {
    const prisma = {
      bookClassificationVersion: {
        findUnique: vi.fn().mockResolvedValue({ ...draft, status: 'approved' }),
      },
      bookFeatureApplicability: { findMany: vi.fn() },
      tagVersion: { findMany: vi.fn() },
    };
    const chatJson = vi.fn();
    const service = new BookClassificationAiService(prisma as never, { chatJson } as never, { buildBlock: vi.fn().mockResolvedValue('') } as never);

    await expect(service.proposeFromMarkdown('class-1', '# Capítulo 1')).rejects.toThrow(/borrador/);
    expect(chatJson).not.toHaveBeenCalled();
  });
});

describe('DeepseekClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses the JSON content from the completion response', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: '{"features":{},"tags":{}}' } }] }));
    const client = new DeepseekClient('key');
    const result = await client.chatJson({ system: 's', user: 'u' });
    expect(result).toEqual({ features: {}, tags: {} });
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(body.model).toBe('deepseek-v4-flash');
    expect(body.reasoning_effort).toBe('high');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content).toBe('s');
  });

  it('strips markdown fences before parsing', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: '```json\n{"a":1}\n```' } }] }));
    const client = new DeepseekClient('key');
    const result = await client.chatJson({ system: 's', user: 'u' });
    expect(result).toEqual({ a: 1 });
  });

  it('retries once when the model returns invalid JSON', async () => {
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: '' } }] }));
    fetchMock.mockResolvedValueOnce(ok({ choices: [{ message: { content: '{"ok":true}' } }] }));
    const client = new DeepseekClient('key');
    await expect(client.chatJson({ system: 's', user: 'u' })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when no API key is configured', async () => {
    const client = new DeepseekClient('');
    await expect(client.chatJson({ system: 's', user: 'u' })).rejects.toThrow(/DEEPSEEK_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('truncateMarkdown', () => {
  it('keeps short markdown intact', () => {
    const text = 'a'.repeat(100);
    expect(truncateMarkdown(text, 200)).toBe(text);
  });

  it('keeps start, middle and end samples for long markdown', () => {
    const text = 'A'.repeat(300) + 'B'.repeat(300) + 'C'.repeat(300);
    const truncated = truncateMarkdown(text, 300);
    expect(truncated.length).toBeLessThan(text.length);
    expect(truncated.startsWith('A')).toBe(true);
    expect(truncated.includes('B')).toBe(true);
    expect(truncated.endsWith('C')).toBe(true);
    expect(truncated).toContain('sección central omitida');
  });
});

describe('buildClassificationUserMessage', () => {
  const base = {
    editionContext: 'Título de la edición: El Principito\nAutor(es): Antoine de Saint-Exupéry',
    markdown: '# El Principito\nHabía una vez…',
    contentTypeKey: 'fiction',
  };

  it('includes the external context block when provided', () => {
    const message = buildClassificationUserMessage({
      ...base,
      externalContext: 'Fuente: OpenLibrary (metadatos públicos).\nTemas: fantasy, friendship, love',
    });
    expect(message).toContain('### Contexto externo (fuentes públicas)');
    expect(message).toContain('Fuente: OpenLibrary');
    expect(message).toContain('fantasy, friendship, love');
  });

  it('omits the external context section when not provided', () => {
    const message = buildClassificationUserMessage(base);
    expect(message).not.toContain('Contexto externo');
  });

  it('labels page sampling coverage when the PDF was sampled', () => {
    const message = buildClassificationUserMessage({
      ...base,
      pageCount: 300,
      sampledPages: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 145, 146, 147, 148, 149, 150, 151],
    });
    expect(message).toContain('Muestra de 17 páginas de un total de 300');
    expect(message).toContain('inicio, sección media y final');
    expect(message).toContain('INICIO, SECCIÓN MEDIA y FINAL');
  });

  it('labels full text as complete when everything was sent', () => {
    const message = buildClassificationUserMessage(base);
    expect(message).toContain('Completa.');
  });
});
