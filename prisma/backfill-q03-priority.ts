import { Prisma, PrismaClient } from '@prisma/client';
import { ProfileService } from '../src/profile/profile.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildPriorityVector, PRIORITY_VECTOR_MAPPING_VERSION, PRIORITY_VECTOR_NORMALIZATION_METHOD, PriorityFactor, PriorityVector } from '../src/scoring/priority-vector';

export async function backfillQ03Priority(prisma: PrismaClient) {
  const answers = await prisma.questionAnswer.findMany({
    where: { questionKey: 'Q03_PRIORITY_RANKING' },
    include: { session: { select: { userId: true } } },
  });
  const results = [];
  for (const answer of answers) {
    const ranking = extractRanking(answer.normalizedResponse) ?? extractRanking(answer.rawResponse);
    if (!ranking) {
      results.push({ userId: answer.session.userId, answerId: answer.id, updatedAnswer: false, profileVersionCreated: false, skipped: 'no ranking found' });
      continue;
    }
    let priorityVector: PriorityVector;
    try {
      priorityVector = buildPriorityVector(ranking as PriorityFactor[]);
    } catch (error) {
      results.push({ userId: answer.session.userId, answerId: answer.id, updatedAnswer: false, profileVersionCreated: false, skipped: error instanceof Error ? error.message : 'invalid ranking' });
      continue;
    }
    const normalized = answer.normalizedResponse as Record<string, unknown>;
    const alreadyMapped = normalized.priorityVector !== undefined && normalized.mappingVersion === PRIORITY_VECTOR_MAPPING_VERSION;
    if (!alreadyMapped) {
      await prisma.questionAnswer.update({
        where: { id: answer.id },
        data: {
          normalizedResponse: {
            ...normalized,
            ranking,
            priorityVector,
            normalizationMethod: PRIORITY_VECTOR_NORMALIZATION_METHOD,
            mappingVersion: PRIORITY_VECTOR_MAPPING_VERSION,
          } as Prisma.InputJsonValue,
        },
      });
    }
    const result = await new ProfileService(prisma as unknown as PrismaService).recompute(answer.session.userId, 'q03_priority_vector_backfill', answer.id);
    results.push({ userId: answer.session.userId, answerId: answer.id, updatedAnswer: !alreadyMapped, profileVersionCreated: result.created });
  }
  return results;
}

function extractRanking(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'string') ? value as string[] : null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const property of ['ranking', 'optionKeys']) {
    if (Array.isArray(record[property]) && record[property].every((item) => typeof item === 'string')) return record[property] as string[];
  }
  return null;
}
