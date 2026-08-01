import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { upsertTags } from '../prisma/seed-tags';
import { TAG_PARENTS, TAG_TAXONOMY_VERSION } from '../src/profile/catalog';
import { assertTestDatabase } from './helpers/test-database';

const url = process.env.TEST_DATABASE_URL;
const run = describe.runIf(Boolean(url));
assertTestDatabase(url);

const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;

run('taxonomía de tags: parentTagKey y seed idempotente', () => {
  beforeAll(async () => {
    await upsertTags(prisma!);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('persiste parentTagKey en los subgéneros, apuntando a su género', async () => {
    const rows = await prisma!.tagVersion.findMany({
      where: { taxonomicVersion: TAG_TAXONOMY_VERSION, tagType: 'subgenre' },
      select: { tagKey: true, parentTagKey: true },
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.parentTagKey).toBe(TAG_PARENTS[row.tagKey]);
    }
  });

  it('todos los subgéneros documentados tienen vínculo padre en el catálogo', async () => {
    expect(Object.keys(TAG_PARENTS).length).toBe(24);
    const rows = await prisma!.tagVersion.findMany({
      where: { taxonomicVersion: TAG_TAXONOMY_VERSION, tagType: 'subgenre' },
      select: { tagKey: true },
    });
    expect(new Set(rows.map((row) => row.tagKey))).toEqual(new Set(Object.keys(TAG_PARENTS)));
  });

  it('los tags que no son subgénero quedan sin parentTagKey', async () => {
    const rows = await prisma!.tagVersion.findMany({
      where: { taxonomicVersion: TAG_TAXONOMY_VERSION, tagType: { not: 'subgenre' } },
      select: { tagKey: true, parentTagKey: true },
    });
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.parentTagKey).toBeNull();
    }
  });

  it('re-ejecutar el upsert del seed no duplica filas ni pierde datos', async () => {
    const before = await prisma!.tagVersion.count({ where: { taxonomicVersion: TAG_TAXONOMY_VERSION } });
    const sample = await prisma!.tagVersion.findFirstOrThrow({ where: { tagKey: 'space_opera', taxonomicVersion: TAG_TAXONOMY_VERSION } });
    const nameBefore = sample.name;
    const statusBefore = sample.status;

    await upsertTags(prisma!);

    const after = await prisma!.tagVersion.count({ where: { taxonomicVersion: TAG_TAXONOMY_VERSION } });
    expect(after).toBe(before);
    const sampleAfter = await prisma!.tagVersion.findFirstOrThrow({ where: { tagKey: 'space_opera', taxonomicVersion: TAG_TAXONOMY_VERSION } });
    expect(sampleAfter.name).toBe(nameBefore);
    expect(sampleAfter.status).toBe(statusBefore);
    expect(sampleAfter.parentTagKey).toBe('science_fiction');
  });
});
