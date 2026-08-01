import { EvidenceStatus, PrismaClient } from '@prisma/client';
import { ProfileService } from '../src/profile/profile.service';
import { PrismaService } from '../src/prisma/prisma.service';

const ATMOSPHERE_REASON_CODE = 'f05_atmosphere_learn';

// Desactiva (no elimina) la evidencia dimensional aprendida del aspecto
// genérico "atmosphere" (reasonCode f05_atmosphere_learn) generada por
// reading_feedback, y recomputa los perfiles afectados.
//
// Conserva el historial: solo cambia el estado de la evidencia a 'deactivated'
// y recompute crea una nueva versión de perfil. No toca evidencia del
// cuestionario ni otros aspectos del mismo feedback.
//
// Idempotente: solo actúa sobre evidencia activa con ese reasonCode.
export async function deactivateAtmosphereEvidence(prisma: PrismaClient) {
  const evidence = await prisma.readerEvidence.findMany({
    where: { sourceType: 'reading_feedback', reasonCode: ATMOSPHERE_REASON_CODE, status: EvidenceStatus.active },
  });

  const now = new Date();
  const deactivated: Array<{ evidenceId: string; feedbackId: string; profileId: string; dimensionKey: string }> = [];
  const profileIds = new Set<string>();
  for (const item of evidence) {
    await prisma.readerEvidence.update({
      where: { id: item.id },
      data: { status: EvidenceStatus.deactivated, deactivatedAt: now },
    });
    deactivated.push({ evidenceId: item.id, feedbackId: item.sourceId, profileId: item.profileId, dimensionKey: item.dimensionKey });
    profileIds.add(item.profileId);
  }

  const profileService = new ProfileService(prisma as unknown as PrismaService);
  const recomputed: Array<{ profileId: string; userId: string; versionCreated: boolean }> = [];
  for (const profileId of profileIds) {
    const profile = await prisma.readerProfile.findUnique({ where: { id: profileId }, select: { userId: true } });
    if (!profile) continue;
    const result = await profileService.recompute(profile.userId, 'atmosphere_evidence_correction', undefined);
    recomputed.push({ profileId, userId: profile.userId, versionCreated: result.created });
  }

  return { deactivated, recomputed };
}
