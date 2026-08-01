import { describe, expect, it } from 'vitest';
import { buildPriorityVector, PriorityVectorError } from '../src/scoring/priority-vector';

describe('buildPriorityVector', () => {
  it('assigns 0.5, 0.3333 and 0.1667 to first, second and third place', () => {
    const vector = buildPriorityVector(['characters', 'atmosphere', 'plot']);
    expect(vector.characters).toBe(0.5);
    expect(vector.atmosphere).toBe(0.3333);
    expect(vector.plot).toBe(0.1667);
    expect(vector.ideas).toBe(0);
    expect(vector.style).toBe(0);
    expect(vector.emotion).toBe(0);
  });

  it('always includes every factor with non-selected factors set to 0', () => {
    const vector = buildPriorityVector(['plot', 'style', 'emotion']);
    expect(Object.keys(vector).sort()).toEqual(['atmosphere', 'characters', 'emotion', 'ideas', 'plot', 'style']);
    expect(vector).toEqual({ plot: 0.5, style: 0.3333, emotion: 0.1667, characters: 0, ideas: 0, atmosphere: 0 });
  });

  it('sums to 1.0000', () => {
    const vector = buildPriorityVector(['characters', 'atmosphere', 'plot']);
    const sum = Object.values(vector).reduce((acc, value) => acc + value, 0);
    expect(sum).toBe(1);
  });

  it('changes the vector when the same three factors change order', () => {
    const first = buildPriorityVector(['characters', 'atmosphere', 'plot']);
    const second = buildPriorityVector(['plot', 'atmosphere', 'characters']);
    expect(first.characters).toBe(0.5);
    expect(second.characters).toBe(0.1667);
    expect(first.plot).toBe(0.1667);
    expect(second.plot).toBe(0.5);
  });

  it('rejects a ranking with fewer than three factors', () => {
    expect(() => buildPriorityVector(['characters', 'atmosphere'])).toThrow(PriorityVectorError);
  });

  it('rejects a ranking with more than three factors', () => {
    expect(() => buildPriorityVector(['characters', 'atmosphere', 'plot', 'style'])).toThrow(PriorityVectorError);
  });

  it('rejects duplicate factors', () => {
    expect(() => buildPriorityVector(['characters', 'characters', 'plot'])).toThrow(PriorityVectorError);
  });

  it('rejects unknown factors', () => {
    expect(() => buildPriorityVector(['characters', 'atmosphere', 'unknown'] as never)).toThrow(PriorityVectorError);
  });
});
