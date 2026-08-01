export type TagTerm = {
  tagKey: string;
  name: string;
  aliases: string[];
};

export type TagMention = {
  tagKey: string;
  polarity: 1 | -1 | 0;
  matchedText: string;
};

const NEGATIVE_MARKERS = [
  'no me gustó', 'no me gusto', 'no me ha gustado', 'no me convenció', 'no me convencio',
  'no me interesó', 'no me intereso', 'no me enganchó', 'no me engancho', 'no me atrapó',
  'no me atrajo', 'aborrecí', 'aborreci', 'odio', 'odié', 'odie', 'aburrió', 'aburrio',
  'aburrido', 'pesado', 'decepcionó', 'decepciono', 'terrible', 'malísimo', 'malisimo',
  'no me gusta', 'no me llama', 'no fue lo mío', 'no fue lo mio', 'meh', 'desperdicio',
] as const;

const POSITIVE_MARKERS = [
  'me encantó', 'me encanto', 'me encanta', 'me gustó mucho', 'me gusto mucho',
  'me fascinó', 'me fascino', 'disfruté', 'disfrute', 'me gustó', 'me gusto',
  'me atrapó', 'me atrapo', 'me enganchó', 'me engancho', 'me interesó', 'me intereso',
  'amé', 'ame', 'adoré', 'adore', 'me atrajo', 'excelente', 'maravilloso',
  'precioso', 'buenísimo', 'buenisimo', 'increíble', 'increible', 'fantástico', 'fantastico',
] as const;

const WINDOW_TOKENS = 6;

function normalize(text: string): string {
  return text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildTerms(tag: TagTerm): Array<{ text: string; source: 'name' | 'alias' }> {
  const terms: Array<{ text: string; source: 'name' | 'alias' }> = [];
  for (const candidate of [tag.name, ...tag.aliases]) {
    const normalizedCandidate = normalize(candidate).trim();
    if (normalizedCandidate.length >= 3) terms.push({ text: normalizedCandidate, source: normalizedCandidate === tag.name ? 'name' : 'alias' });
  }
  return terms;
}

function sentenceAt(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf('.', index), text.lastIndexOf('!', index), text.lastIndexOf('?', index), text.lastIndexOf(';', index));
  const end = text.length;
  let cursor = index;
  while (cursor < end && !'!?.;'.includes(text[cursor] ?? '')) cursor += 1;
  return text.slice(start === 0 ? 0 : start + 1, cursor);
}

function polarityForSentence(sentence: string, matchedIndex: number): 1 | -1 | 0 {
  const tokens = sentence.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const matchStart = tokens.findIndex((token, tokenIndex) => {
    const from = tokens.slice(0, tokenIndex).join(' ').length + (tokenIndex === 0 ? 0 : 1);
    return matchedIndex >= from && matchedIndex < from + token.length;
  });
  const start = Math.max(0, (matchStart === -1 ? 0 : matchStart) - WINDOW_TOKENS);
  const end = Math.min(tokens.length, (matchStart === -1 ? 0 : matchStart) + WINDOW_TOKENS + 1);
  const window = tokens.slice(start, end).join(' ');
  for (const marker of NEGATIVE_MARKERS) {
    if (window.includes(normalize(marker))) return -1;
  }
  for (const marker of POSITIVE_MARKERS) {
    if (window.includes(normalize(marker))) return 1;
  }
  return 0;
}

export function extractExplicitTagMentions(freeText: string, tags: TagTerm[]): TagMention[] {
  const normalized = normalize(freeText);
  if (!normalized.trim()) return [];

  const candidates: Array<{ text: string; tagKey: string }> = [];
  for (const tag of tags) {
    for (const term of buildTerms(tag)) {
      candidates.push({ text: term.text, tagKey: tag.tagKey });
    }
  }
  candidates.sort((a, b) => b.text.length - a.text.length);

  const mentions: TagMention[] = [];
  const used = new Set<number>();
  for (const candidate of candidates) {
    let from = 0;
    while (from < normalized.length) {
      const index = normalized.indexOf(candidate.text, from);
      if (index === -1) break;
      const before = normalized[index - 1];
      const after = normalized[index + candidate.text.length];
      const boundaryOk = (before === undefined || !/[a-z0-9áéíóúüñ]/.test(before)) && (after === undefined || !/[a-z0-9áéíóúüñ]/.test(after));
      if (boundaryOk && !used.has(index)) {
        used.add(index);
        const sentence = sentenceAt(normalized, index);
        const polarity = polarityForSentence(sentence, index);
        mentions.push({ tagKey: candidate.tagKey, polarity, matchedText: candidate.text });
      }
      from = index + candidate.text.length;
    }
  }
  const deduped = new Map<string, TagMention>();
  for (const mention of mentions) {
    if (deduped.has(mention.tagKey)) continue;
    deduped.set(mention.tagKey, mention);
  }
  return [...deduped.values()];
}
