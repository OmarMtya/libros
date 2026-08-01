import { describe, expect, it } from 'vitest';
import { applicabilityFor, buildApplicabilityMatrix, CONTENT_TYPE_KEYS, CONTENT_TYPE_SCHEMA_VERSION, BOOK_FEATURE_SCHEMA_VERSION, BOOK_FEATURE_DEFINITIONS } from '../src/catalog';
import { CONTENT_TYPES } from '../src/catalog/content-type-definitions';

describe('book feature applicability', () => {
  it('misma feature es required para fiction, optional para memoir y not_applicable para expository_nonfiction', () => {
    expect(applicabilityFor('character_depth', 'fiction')).toBe('required');
    expect(applicabilityFor('character_depth', 'memoir')).toBe('required');
    expect(applicabilityFor('character_depth', 'expository_nonfiction')).toBe('not_applicable');
    expect(applicabilityFor('character_agency', 'expository_nonfiction')).toBe('not_applicable');
    expect(applicabilityFor('cast_size_load', 'expository_nonfiction')).toBe('not_applicable');
    expect(applicabilityFor('ending_openness', 'expository_nonfiction')).toBe('not_applicable');
  });

  it('todas las features requieren una regla para cada content_type (sin config errors)', () => {
    const matrix = buildApplicabilityMatrix();
    expect(matrix.length).toBe(BOOK_FEATURE_DEFINITIONS.length * CONTENT_TYPE_KEYS.length);
    const byCombo = new Map(matrix.map((row) => [`${row.featureKey}|${row.contentTypeKey}`, row.requirement]));
    for (const definition of BOOK_FEATURE_DEFINITIONS) {
      for (const contentTypeKey of CONTENT_TYPE_KEYS) {
        expect(byCombo.has(`${definition.featureKey}|${contentTypeKey}`)).toBe(true);
      }
    }
  });

  it('las 21 features requeridas son requeridas para fiction y short_stories', () => {
    for (const contentTypeKey of ['fiction', 'short_stories'] as const) {
      for (const definition of BOOK_FEATURE_DEFINITIONS) {
        const requirement = applicabilityFor(definition.featureKey, contentTypeKey);
        expect(['required', 'optional', 'not_applicable']).toContain(requirement);
      }
    }
    expect(applicabilityFor('character_depth', 'fiction')).toBe('required');
  });

  it('not_applicable no equivale a value=0: la regla existe y no exige la feature', () => {
    const row = buildApplicabilityMatrix().find((item) => item.featureKey === 'character_depth' && item.contentTypeKey === 'expository_nonfiction');
    expect(row?.requirement).toBe('not_applicable');
    expect(row?.contentTypeSchemaVersion).toBe(CONTENT_TYPE_SCHEMA_VERSION);
    expect(row?.featureSchemaVersion).toBe(BOOK_FEATURE_SCHEMA_VERSION);
  });

  it('el catálogo runtime y el catálogo de content types usan versiones únicas consistentes', () => {
    const versions = new Set(CONTENT_TYPES.map((item) => item.schemaVersion));
    expect(versions.size).toBe(1);
    const featureVersions = new Set(BOOK_FEATURE_DEFINITIONS.map((item) => item.schemaVersion));
    expect(featureVersions.size).toBe(1);
    expect(CONTENT_TYPES.length).toBe(CONTENT_TYPE_KEYS.length);
  });

  it('feature desconocida no tiene definición en el catálogo', () => {
    const known = new Set(BOOK_FEATURE_DEFINITIONS.map((definition) => definition.featureKey));
    expect(known.has('character_depth')).toBe(true);
    expect(known.has('not_a_real_feature')).toBe(false);
  });
});
