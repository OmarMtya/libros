import { Prisma, PrismaClient, ProductPackageKey } from '@prisma/client';
import { DIMENSIONS, QUESTIONS, QUESTIONNAIRE_VERSION, TAGS, TAG_TAXONOMY_VERSION } from '../src/profile/catalog';

const prisma = new PrismaClient();

async function main() {
  for (const dimension of DIMENSIONS) {
    await prisma.dimensionDefinition.upsert({
      where: { key: dimension.key },
      create: { ...dimension, lowerLabel: '0.00', upperLabel: '1.00', schemaVersion: 'reader-profile/1.1.1' },
      update: { ...dimension, isActive: true },
    });
  }

  for (const question of QUESTIONS) {
    const definition = await prisma.questionDefinition.upsert({
      where: { questionKey_questionnaireVersion: { questionKey: question.key, questionnaireVersion: QUESTIONNAIRE_VERSION } },
      create: {
        questionKey: question.key,
        version: 2,
        questionnaireVersion: QUESTIONNAIRE_VERSION,
        textEsMx: question.text,
        responseType: question.type,
        isRequired: question.required,
        displayOrder: question.order,
        branchingRulesJson: question.branch as Prisma.InputJsonValue | undefined,
        validationJson: question.validation as Prisma.InputJsonValue | undefined,
      },
      update: { textEsMx: question.text },
    });

    for (const [sortOrder, option] of (question.options ?? []).entries()) {
      await prisma.questionOptionMapping.upsert({
        where: { questionId_optionKey: { questionId: definition.id, optionKey: option.key } },
        create: {
          questionId: definition.id,
          optionKey: option.key,
          labelEsMx: option.label,
          evidenceMappingsJson: option.mappings ?? [],
          sortOrder,
        },
        update: {},
      });
    }
  }

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
        status: deprecated ? 'deprecated' : 'active',
        replacementTagKey: deprecated ? 'anglo_united_states' : null,
        deprecatedReason: deprecated ? 'Split into anglo_united_states and anglo_united_kingdom.' : null,
      },
      update: {},
    });
  }

  const packages = [
    { key: ProductPackageKey.libro_sorpresa_fisico, name: 'Libro sorpresa', description: 'Un libro físico elegido para ti.', priceCents: 49900, includedFormats: ['physical'] },
    { key: ProductPackageKey.libro_sorpresa_completo, name: 'Experiencia completa', description: 'Libro físico, ebook y audiolibro cuando estén disponibles.', priceCents: 79900, includedFormats: ['physical', 'ebook', 'audiobook'] },
  ];
  for (const productPackage of packages) {
    await prisma.productPackage.upsert({
      where: { key: productPackage.key },
      create: productPackage,
      update: { name: productPackage.name, description: productPackage.description, priceCents: productPackage.priceCents, includedFormats: productPackage.includedFormats },
    });
  }
}

main()
  .finally(async () => prisma.$disconnect());
