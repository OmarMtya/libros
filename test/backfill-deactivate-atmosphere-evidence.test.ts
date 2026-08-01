import { EvidenceStatus } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deactivateAtmosphereEvidence } from '../prisma/backfill-deactivate-atmosphere-evidence';
import { ProfileService } from '../src/profile/profile.service';

type EvidenceRow = {
  id: string;
  sourceType: string;
  sourceId: string;
  profileId: string;
  dimensionKey: string;
  reasonCode: string;
  status: EvidenceStatus;
};

function prismaMock(rows: EvidenceRow[]) {
  const update = vi.fn().mockImplementation(async (args: { where: { id: string }; data: unknown }) => {
    const row = rows.find((candidate) => candidate.id === args.where.id);
    return { id: args.where.id, ...row, ...(args.data as object) };
  });
  const findMany = vi.fn().mockImplementation(async ({ where }: { where?: Record<string, unknown> }) => {
    return rows.filter((row) =>
      (!where?.sourceType || row.sourceType === where.sourceType) &&
      (!where?.reasonCode || row.reasonCode === where.reasonCode) &&
      (!where?.status || row.status === where.status),
    );
  });
  const findUnique = vi.fn().mockResolvedValue(null);
  return { readerEvidence: { findMany, update }, readerProfile: { findUnique }, update, findMany, findUnique };
}

describe('deactivateAtmosphereEvidence', () => {
  afterEach(() => vi.restoreAllMocks());

  it('desactiva solo evidencia activa de reading_feedback con f05_atmosphere_learn', async () => {
    const atmosphere: EvidenceRow = { id: 'ev-atm', sourceType: 'reading_feedback', sourceId: 'fb-1', profileId: 'p-1', dimensionKey: 'descriptive_density_preference', reasonCode: 'f05_atmosphere_learn', status: EvidenceStatus.active };
    const prisma = prismaMock([atmosphere]);
    prisma.readerProfile.findUnique.mockResolvedValue({ userId: 'u-1' });
    vi.spyOn(ProfileService.prototype, 'recompute').mockResolvedValue({ profile: { id: 'p-1' }, version: null, created: true } as never);

    const result = await deactivateAtmosphereEvidence(prisma as never);

    expect(prisma.findMany).toHaveBeenCalledWith({
      where: { sourceType: 'reading_feedback', reasonCode: 'f05_atmosphere_learn', status: EvidenceStatus.active },
    });
    expect(prisma.update).toHaveBeenCalledWith({
      where: { id: 'ev-atm' },
      data: { status: EvidenceStatus.deactivated, deactivatedAt: expect.any(Date) },
    });
    expect(result.deactivated).toEqual([{ evidenceId: 'ev-atm', feedbackId: 'fb-1', profileId: 'p-1', dimensionKey: 'descriptive_density_preference' }]);
    expect(ProfileService.prototype.recompute).toHaveBeenCalledWith('u-1', 'atmosphere_evidence_correction', undefined);
    expect(result.recomputed).toEqual([{ profileId: 'p-1', userId: 'u-1', versionCreated: true }]);
  });

  it('no desactiva evidencia del cuestionario ni otros aspectos del mismo feedback', async () => {
    const rows: EvidenceRow[] = [
      { id: 'ev-atm', sourceType: 'reading_feedback', sourceId: 'fb-1', profileId: 'p-1', dimensionKey: 'descriptive_density_preference', reasonCode: 'f05_atmosphere_learn', status: EvidenceStatus.active },
      { id: 'ev-tension', sourceType: 'reading_feedback', sourceId: 'fb-1', profileId: 'p-1', dimensionKey: 'tension_preference', reasonCode: 'f05_tension_learn', status: EvidenceStatus.active },
      { id: 'ev-q11', sourceType: 'questionnaire', sourceId: 'q-1', profileId: 'p-1', dimensionKey: 'd', reasonCode: 'q11_initial', status: EvidenceStatus.active },
    ];
    const prisma = prismaMock(rows);
    prisma.readerProfile.findUnique.mockResolvedValue({ userId: 'u-1' });
    vi.spyOn(ProfileService.prototype, 'recompute').mockResolvedValue({ profile: { id: 'p-1' }, version: null, created: true } as never);

    const result = await deactivateAtmosphereEvidence(prisma as never);

    expect(prisma.update).toHaveBeenCalledTimes(1);
    expect(prisma.update).toHaveBeenCalledWith({ where: { id: 'ev-atm' }, data: { status: EvidenceStatus.deactivated, deactivatedAt: expect.any(Date) } });
    expect(result.deactivated.map((item) => item.evidenceId)).toEqual(['ev-atm']);
  });

  it('es idempotente: sin evidencia activa de atmosphere no hace nada en una segunda corrida', async () => {
    const rows: EvidenceRow[] = [
      { id: 'ev-tension', sourceType: 'reading_feedback', sourceId: 'fb-1', profileId: 'p-1', dimensionKey: 'tension_preference', reasonCode: 'f05_tension_learn', status: EvidenceStatus.active },
    ];
    const prisma = prismaMock(rows);

    const result = await deactivateAtmosphereEvidence(prisma as never);

    expect(prisma.update).not.toHaveBeenCalled();
    expect(prisma.findUnique).not.toHaveBeenCalled();
    expect(result.deactivated).toEqual([]);
    expect(result.recomputed).toEqual([]);
  });
});
