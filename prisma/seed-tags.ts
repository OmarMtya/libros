import { PrismaClient } from '@prisma/client';
import { DEPRECATED_TAGS, TAGS, TAG_TAXONOMY_VERSION } from '../src/profile/catalog';

export async function upsertTags(prisma: PrismaClient): Promise<void> {
  for (const tag of TAGS) {
    await prisma.tagIdentity.upsert({
      where: { tagKey: tag.key },
      create: {
        tagKey: tag.key,
        canonicalTaxonomicVersion: TAG_TAXONOMY_VERSION,
        currentStatus: 'active',
        currentReplacementTagKey: null,
      },
      update: { currentStatus: 'active', currentReplacementTagKey: null },
    });
    await prisma.tagVersion.upsert({
      where: { tagKey_taxonomicVersion: { tagKey: tag.key, taxonomicVersion: TAG_TAXONOMY_VERSION } },
      create: {
        tagKey: tag.key,
        taxonomicVersion: TAG_TAXONOMY_VERSION,
        tagType: tag.tagType,
        name: tag.key.replaceAll('_', ' '),
        description: tag.key.replaceAll('_', ' '),
        aliasesJson: [],
        parentTagKey: tag.parentTagKey ?? null,
        status: 'active',
        replacementTagKey: null,
        deprecatedReason: null,
      },
      update: { parentTagKey: tag.parentTagKey ?? null, status: 'active', replacementTagKey: null, deprecatedReason: null },
    });
  }

  for (const tag of DEPRECATED_TAGS) {
    const replacement = tag.replacementTagKey ?? null;
    await prisma.tagIdentity.upsert({
      where: { tagKey: tag.key },
      create: {
        tagKey: tag.key,
        canonicalTaxonomicVersion: TAG_TAXONOMY_VERSION,
        currentStatus: 'deprecated',
        currentReplacementTagKey: replacement,
      },
      update: { currentStatus: 'deprecated', currentReplacementTagKey: replacement },
    });
    await prisma.tagVersion.upsert({
      where: { tagKey_taxonomicVersion: { tagKey: tag.key, taxonomicVersion: TAG_TAXONOMY_VERSION } },
      create: {
        tagKey: tag.key,
        taxonomicVersion: TAG_TAXONOMY_VERSION,
        tagType: tag.tagType,
        name: tag.key.replaceAll('_', ' '),
        description: tag.key.replaceAll('_', ' '),
        aliasesJson: [],
        parentTagKey: null,
        status: 'deprecated',
        replacementTagKey: replacement,
        deprecatedReason: tag.deprecatedReason,
      },
      update: { status: 'deprecated', replacementTagKey: replacement, deprecatedReason: tag.deprecatedReason },
    });
  }
}
