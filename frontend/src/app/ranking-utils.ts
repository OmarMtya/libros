export const RANKING_MAX = 3;

export function toggleRankingSelection(selected: string[], key: string, max = RANKING_MAX): string[] {
  if (selected.includes(key)) return selected.filter((item) => item !== key);
  if (selected.length >= max) return selected;
  return [...selected, key];
}

export function rankingPosition(selected: string[], key: string): number {
  return selected.indexOf(key) + 1;
}

export function rankingDisabled(selected: string[], key: string, max = RANKING_MAX): boolean {
  return selected.length >= max && !selected.includes(key);
}
