import { describe, expect, it } from 'vitest';
import { extractExplicitTagMentions, TagTerm } from '../src/feedback/explicit-tag-mentions';

const TAGS: TagTerm[] = [
  { tagKey: 'science_fiction', name: 'Ciencia ficción', aliases: ['ciencia ficción', 'sci-fi', 'cienciaf'].filter((alias) => alias.length >= 3) },
  { tagKey: 'space_opera', name: 'Space opera', aliases: ['space opera', 'opera espacial', 'espacial'] },
  { tagKey: 'romance', name: 'Romance', aliases: ['romance'] },
  { tagKey: 'cosmic_horror', name: 'Horror cósmico', aliases: ['horror cósmico'] },
];

const mentions = (text: string) => extractExplicitTagMentions(text, TAGS);

describe('extractExplicitTagMentions', () => {
  it('“No me gustó la ciencia ficción” → science_fiction negativo (polaridad por frase)', () => {
    const result = mentions('No me gustó la ciencia ficción.');
    const scienceFiction = result.find((mention) => mention.tagKey === 'science_fiction');
    expect(scienceFiction?.polarity).toBe(-1);
  });

  it('“Me encantó la ambientación espacial” → space_opera positivo', () => {
    const result = mentions('Me encantó la ambientación espacial.');
    expect(result.find((mention) => mention.tagKey === 'space_opera')?.polarity).toBe(1);
  });

  it('“La prosa era demasiado simple” → 0 tags', () => {
    expect(mentions('La prosa era demasiado simple.')).toEqual([]);
  });

  it('“No me gustó” (sin tag) → 0 tags', () => {
    expect(mentions('No me gustó.')).toEqual([]);
  });

  it('mención sin polaridad clara → 0', () => {
    const result = mentions('Leí un libro de ciencia ficción.');
    expect(result.find((mention) => mention.tagKey === 'science_fiction')?.polarity).toBe(0);
  });

  it('mezcla de menciones con polaridades distintas en el mismo texto', () => {
    const result = mentions('No me gustó el romance, pero me encantó la ciencia ficción.');
    expect(result.find((mention) => mention.tagKey === 'romance')?.polarity).toBe(-1);
    expect(result.find((mention) => mention.tagKey === 'science_fiction')?.polarity).toBe(1);
  });

  it('deduplica por tagKey', () => {
    const result = mentions('me encantó la ciencia ficción y la ciencia ficción es lo mío');
    const occurrences = result.filter((mention) => mention.tagKey === 'science_fiction');
    expect(occurrences.length).toBe(1);
  });
});
