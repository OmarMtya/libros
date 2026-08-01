import { describe, expect, it } from 'vitest';
import { BOOK_FEATURE_DEFINITIONS, BOOK_FEATURE_SCHEMA_VERSION } from '../src/catalog/book-feature-definitions';
import { buildApplicabilityMatrix } from '../src/catalog/book-feature-applicability';
import { CONTENT_TYPE_KEYS } from '../src/catalog/content-type-definitions';
import { featureUiMetadata } from '../src/catalog/feature-ui-catalog';

describe('features conceptuales del dominio 6', () => {
  it('conceptual_density y conceptual_depth son features distintas con semántica diferenciada', () => {
    const density = BOOK_FEATURE_DEFINITIONS.find((definition) => definition.featureKey === 'conceptual_density');
    const depth = BOOK_FEATURE_DEFINITIONS.find((definition) => definition.featureKey === 'conceptual_depth');
    expect(density).toBeDefined();
    expect(depth).toBeDefined();
    expect(density!.scope).toBe('work');
    expect(depth!.scope).toBe('work');
    expect(density!.valueSemantics).not.toBe(depth!.valueSemantics);
    expect(density!.valueSemantics).toMatch(/frecuencia/);
    expect(depth!.valueSemantics).toMatch(/profund/);
  });

  it('la aplicabilidad no cambia: conceptual_density requerida y conceptual_depth opcional en todos los content types', () => {
    for (const contentTypeKey of CONTENT_TYPE_KEYS) {
      const rows = buildApplicabilityMatrix().filter(
        (row) => row.featureSchemaVersion === BOOK_FEATURE_SCHEMA_VERSION && row.contentTypeKey === contentTypeKey,
      );
      expect(rows.find((row) => row.featureKey === 'conceptual_density')?.requirement).toBe('required');
      expect(rows.find((row) => row.featureKey === 'conceptual_depth')?.requirement).toBe('optional');
      expect(rows.find((row) => row.featureKey === 'conceptual_depth')?.requirement).not.toBe('not_applicable');
    }
  });

  it('los tooltips de la UI distinguen ambas features', () => {
    const density = featureUiMetadata('conceptual_density');
    const depth = featureUiMetadata('conceptual_depth');
    expect(density.description).not.toBe(depth.description);
    expect(density.meaningZero).not.toBe(depth.meaningZero);
    expect(density.meaningOne).not.toBe(depth.meaningOne);
    expect(depth.meaningZero).toMatch(/trama inmediata/);
    expect(depth.meaningOne).toMatch(/filosófica/);
  });
});
