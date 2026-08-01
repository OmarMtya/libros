import Decimal from 'decimal.js';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../profile/profile-calculation';

export const PRIORITY_FACTORS = ['plot', 'characters', 'ideas', 'atmosphere', 'style', 'emotion'] as const;
export type PriorityFactor = (typeof PRIORITY_FACTORS)[number];
export type PriorityVector = Record<PriorityFactor, number>;

export const PRIORITY_VECTOR_MAPPING_VERSION = 'priority-vector/1.0';
export const PRIORITY_VECTOR_NORMALIZATION_METHOD = 'borda_3_2_1_div_6';

export class PriorityVectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PriorityVectorError';
  }
}

const BORDA_WEIGHTS = [new Decimal(3).div(6), new Decimal(2).div(6), new Decimal(1).div(6)];

export function buildPriorityVector(ranking: PriorityFactor[]): PriorityVector {
  if (!Array.isArray(ranking) || ranking.length !== 3) throw new PriorityVectorError('Ranking must contain exactly three factors.');
  if (new Set(ranking).size !== ranking.length) throw new PriorityVectorError('Ranking must contain three distinct factors.');
  if (!ranking.every((factor) => PRIORITY_FACTORS.includes(factor))) throw new PriorityVectorError(`Ranking contains an unknown factor. Allowed: ${PRIORITY_FACTORS.join(', ')}.`);
  const vector: PriorityVector = Object.fromEntries(PRIORITY_FACTORS.map((factor) => [factor, 0])) as PriorityVector;
  ranking.forEach((factor, index) => {
    vector[factor] = BORDA_WEIGHTS[index]!.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  });
  const sum = PRIORITY_FACTORS.reduce((acc, factor) => acc.plus(vector[factor]), new Decimal(0));
  if (!sum.equals(1)) throw new PriorityVectorError(`Priority vector must sum to 1.0000, got ${sum.toFixed(4)}.`);
  return vector;
}

export function priorityVectorHash(priority: { ranking: PriorityFactor[]; priorityVector: PriorityVector }): string {
  return createHash('sha256').update(canonicalJson({ ranking: priority.ranking, priorityVector: priority.priorityVector }), 'utf8').digest('hex');
}
