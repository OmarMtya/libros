import { describe, expect, it } from 'vitest';
import { BOOK_FEATURE_DEFINITIONS } from '../src/catalog/book-feature-definitions';
import { FEATURE_UI_CATALOG, featureUiMetadata } from '../src/catalog/feature-ui-catalog';

describe('feature UI catalog', () => {
  it('todas las features del catálogo tienen metadatos legibles en español', () => {
    for (const definition of BOOK_FEATURE_DEFINITIONS) {
      const meta = FEATURE_UI_CATALOG[definition.featureKey];
      expect(meta, `sin metadatos para ${definition.featureKey}`).toBeDefined();
      expect(meta!.label.length).toBeGreaterThan(0);
      expect(meta!.description.length).toBeGreaterThan(0);
      expect(meta!.meaningZero.length).toBeGreaterThan(0);
      expect(meta!.meaningOne.length).toBeGreaterThan(0);
    }
  });

  it('feature desconocida tiene un fallback y no rompe el editor', () => {
    const meta = featureUiMetadata('not_a_real_feature');
    expect(meta.label).toBe('Not A Real Feature');
    expect(meta.description).toBe('not_a_real_feature');
  });

  it('los metadatos usan los nombres técnicos como claves estables', () => {
    const keys = new Set(BOOK_FEATURE_DEFINITIONS.map((definition) => definition.featureKey));
    const catalogKeys = Object.keys(FEATURE_UI_CATALOG);
    for (const key of catalogKeys) {
      expect(keys.has(key), `clave extra en el catálogo UI: ${key}`).toBe(true);
    }
  });
});
