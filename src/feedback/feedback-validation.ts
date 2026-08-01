import { BadRequestException } from '@nestjs/common';
import { EXPOSURE_FACTORS, FEEDBACK_MAPPINGS } from '../profile/catalog';

export const POSITIVE_WITHOUT_DIMENSION = new Set(['length', 'nothing_in_particular', 'other']);
export const NEGATIVE_WITHOUT_DIMENSION = new Set(['topic_no_interest', 'length_problem', 'other']);

export function validateFeedbackPayload(payload: {
  started: boolean;
  readingStatus: string;
  completionPercentage: number;
  notStartedReason?: string | null;
  positiveAspects?: string[];
  negativeAspects?: string[];
}) {
  if (!payload.started && (payload.readingStatus !== 'not_started' || payload.completionPercentage !== 0 || !payload.notStartedReason)) {
    throw new BadRequestException('A book not started must include its reason, status not_started, and 0% completion.');
  }
  if (payload.started && payload.readingStatus === 'not_started') throw new BadRequestException('A started book cannot have status not_started.');
  if (payload.started && payload.notStartedReason) throw new BadRequestException('A started book cannot include a not-started reason.');
  if (payload.readingStatus === 'completed' && payload.completionPercentage !== 100) throw new BadRequestException('Completed feedback must have 100% completion.');
  if (!Object.hasOwn(EXPOSURE_FACTORS, payload.completionPercentage)) throw new BadRequestException('Completion percentage must be one of 0, 5, 18, 38, 63, 88, or 100.');
  const invalidPositive = (payload.positiveAspects ?? []).filter((key) => !FEEDBACK_MAPPINGS.positive[key] && !POSITIVE_WITHOUT_DIMENSION.has(key));
  const invalidNegative = (payload.negativeAspects ?? []).filter((key) => !FEEDBACK_MAPPINGS.negative[key] && !NEGATIVE_WITHOUT_DIMENSION.has(key));
  if (invalidPositive.length || invalidNegative.length) throw new BadRequestException({ message: 'Unknown feedback aspect.', invalidPositive, invalidNegative });
}

export function isFinalFeedback(readingStatus: string): boolean {
  return readingStatus === 'completed' || readingStatus === 'abandoned';
}
