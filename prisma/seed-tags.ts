import { PrismaClient } from '@prisma/client';
import { TAGS, TAG_TAXONOMY_VERSION } from '../src/profile/catalog';

export async function upsertTags(prisma: PrismaClient): Promise<void> {
  for (const tag of TAGS) {
    const deprecated = tag.key === 'anglo_american';
    await prisma.tagIdentity.upsert({
      where: { tagKey: tag.key },
      create: {
        tagKey: tag.key,
        canonicalTaxonomicVersion: TAG_TAXONOMY_VERSION,
        currentStatus: deprecated ? 'deprecated' : 'active',
        currentReplacementTagKey: deprecated ? 'anglo_united_states' : null,
      },
      update: {},
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
        status: deprecated ? 'deprecated' : 'active',
        replacementTagKey: deprecated ? 'anglo_united_states' : null,
        deprecatedReason: deprecated ? 'Split into anglo_united_states and anglo_united_kingdom.' : null,
      },
      update: { parentTagKey: tag.parentTagKey ?? null },
    });
  }
}
