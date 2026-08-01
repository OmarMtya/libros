import { describe, expect, it } from 'vitest';
import { rankingDisabled, rankingPosition, toggleRankingSelection } from '../frontend/src/app/ranking-utils';

describe('ranking selection', () => {
  it('assigns position 1, 2 and 3 in click order', () => {
    let selected: string[] = [];
    selected = toggleRankingSelection(selected, 'characters');
    selected = toggleRankingSelection(selected, 'atmosphere');
    selected = toggleRankingSelection(selected, 'plot');
    expect(selected).toEqual(['characters', 'atmosphere', 'plot']);
    expect(rankingPosition(selected, 'characters')).toBe(1);
    expect(rankingPosition(selected, 'atmosphere')).toBe(2);
    expect(rankingPosition(selected, 'plot')).toBe(3);
  });

  it('disables remaining options after three selections', () => {
    const selected = ['characters', 'atmosphere', 'plot'];
    expect(rankingDisabled(selected, 'style')).toBe(true);
    expect(rankingDisabled(selected, 'characters')).toBe(false);
    expect(toggleRankingSelection(selected, 'style')).toEqual(selected);
  });

  it('removes a selected option on click', () => {
    const selected = ['characters', 'atmosphere', 'plot'];
    expect(toggleRankingSelection(selected, 'atmosphere')).toEqual(['characters', 'plot']);
  });

  it('shifts later positions up when the second selection is removed', () => {
    let selected = ['characters', 'atmosphere', 'plot'];
    selected = toggleRankingSelection(selected, 'atmosphere');
    expect(selected).toEqual(['characters', 'plot']);
    expect(rankingPosition(selected, 'characters')).toBe(1);
    expect(rankingPosition(selected, 'plot')).toBe(2);
  });

  it('allows changing the order without resetting the whole question', () => {
    let selected = ['characters', 'atmosphere', 'plot'];
    selected = toggleRankingSelection(selected, 'characters');
    selected = toggleRankingSelection(selected, 'style');
    expect(selected).toEqual(['atmosphere', 'plot', 'style']);
  });
});
