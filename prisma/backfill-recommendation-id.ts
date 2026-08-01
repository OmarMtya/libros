import { PrismaClient } from '@prisma/client';

// Completa ReadingFeedback.recommendationId cuando pueda derivarse de la
// asignación de curación ligada al candidato realmente seleccionado.
//
// Política: feedback invitation → curation assignment → recommendationCandidateId
// → RecommendationCandidate.recommendationId. NO se usa la Recommendation marcada
// como isCurrent (el scoring pudo ejecutarse de nuevo después de la asignación).
//
// Idempotente: solo considera filas con recommendationId null, por lo que
// re-ejecutarlo no modifica filas ya corregidas.
export async function backfillRecommendationId(prisma: PrismaClient) {
  const feedbacks = await prisma.readingFeedback.findMany({
    where: { recommendationId: null, curationAssignmentId: { not: null } },
    include: {
      assignment: { include: { recommendationCandidate: { select: { recommendationId: true } } } },
    },
  });

  const results: Array<{ feedbackId: string; updated: boolean; recommendationId: string | null; skipped?: string }> = [];
  for (const feedback of feedbacks) {
    const recommendationId = feedback.assignment?.recommendationCandidate?.recommendationId ?? null;
    if (!recommendationId) {
      results.push({ feedbackId: feedback.id, updated: false, recommendationId: null, skipped: 'no linked candidate' });
      continue;
    }
    await prisma.readingFeedback.update({ where: { id: feedback.id }, data: { recommendationId } });
    results.push({ feedbackId: feedback.id, updated: true, recommendationId });
  }
  return results;
}
