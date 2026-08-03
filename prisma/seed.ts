import { Prisma, PrismaClient, ProductPackageKey } from '@prisma/client';
import { DIMENSIONS, QUESTIONS, QUESTIONNAIRE_VERSION, TAG_TAXONOMY_VERSION } from '../src/profile/catalog';
import { BOOK_FEATURE_DEFINITIONS } from '../src/catalog/book-feature-definitions';
import { buildApplicabilityMatrix } from '../src/catalog/book-feature-applicability';
import { CONTENT_TYPES } from '../src/catalog/content-type-definitions';
import { upsertTags } from './seed-tags';

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
      update: { textEsMx: question.text, validationJson: question.validation as Prisma.InputJsonValue | undefined },
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
        update: { labelEsMx: option.label, evidenceMappingsJson: option.mappings ?? [] },
      });
    }
  }

  await upsertTags(prisma);

  const packages = [
    { key: ProductPackageKey.libro_sorpresa_fisico, name: 'Mi libro Sorpresa', description: 'Libro físico elegido para ti.', priceCents: 49900, includedFormats: ['physical'] },
  ];
  for (const productPackage of packages) {
    await prisma.productPackage.upsert({
      where: { key: productPackage.key },
      create: productPackage,
      update: { name: productPackage.name, description: productPackage.description, priceCents: productPackage.priceCents, includedFormats: productPackage.includedFormats },
    });
  }

  for (const contentType of CONTENT_TYPES) {
    await prisma.contentTypeDefinition.upsert({
      where: { contentTypeKey_schemaVersion: { contentTypeKey: contentType.contentTypeKey, schemaVersion: contentType.schemaVersion } },
      create: contentType,
      update: {},
    });
  }

  for (const definition of BOOK_FEATURE_DEFINITIONS) {
    await prisma.bookFeatureDefinition.upsert({
      where: { featureKey_schemaVersion: { featureKey: definition.featureKey, schemaVersion: definition.schemaVersion } },
      create: { featureKey: definition.featureKey, schemaVersion: definition.schemaVersion, scope: definition.scope, valueSemantics: definition.valueSemantics, isActive: definition.isActive },
      update: { valueSemantics: definition.valueSemantics, isActive: definition.isActive },
    });
  }

  for (const row of buildApplicabilityMatrix()) {
    await prisma.bookFeatureApplicability.upsert({
      where: {
        featureKey_featureSchemaVersion_contentTypeKey_contentTypeSchemaVersion: {
          featureKey: row.featureKey,
          featureSchemaVersion: row.featureSchemaVersion,
          contentTypeKey: row.contentTypeKey,
          contentTypeSchemaVersion: row.contentTypeSchemaVersion,
        },
      },
      create: row,
      update: {},
    });
  }
}

main()
  .finally(async () => prisma.$disconnect());
