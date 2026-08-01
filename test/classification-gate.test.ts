import { describe, expect, it } from 'vitest';
import { evaluateClassificationGate } from '../src/curation/classification-gate';
import { BOOK_FEATURE_DEFINITIONS, BOOK_FEATURE_SCHEMA_VERSION } from '../src/catalog/book-feature-definitions';
import { buildApplicabilityMatrix } from '../src/catalog/book-feature-applicability';

const definitions = BOOK_FEATURE_DEFINITIONS.map((definition) => ({ featureKey: definition.featureKey, schemaVersion: definition.schemaVersion }));

function applicabilityFor(contentTypeKey: string) {
  return buildApplicabilityMatrix()
    .filter((row) => row.contentTypeKey === contentTypeKey && row.featureSchemaVersion === BOOK_FEATURE_SCHEMA_VERSION)
    .map((row) => ({ featureKey: row.featureKey, requirement: row.requirement }));
}

describe('evaluateClassificationGate', () => {
  it('novela: requiere features narrativas y de personajes (missing_required si faltan)', () => {
    const result = evaluateClassificationGate({
      featureDefinitions: definitions,
      applicability: applicabilityFor('fiction'),
      presentFeatureKeys: [],
      tags: [{ tagKey: 'science_fiction', tagType: 'genre' }, { tagKey: 'identity', tagType: 'theme' }],
      applicableSubgenreKeys: ['space_opera', 'cyberpunk'],
    });
    expect(result.passes).toBe(false);
    expect(result.missingRequired).toContain('character_depth');
    expect(result.missingRequired).toContain('hook_speed');
  });

  it('libro expositivo de economía: features de personajes not_applicable y no bloquea', () => {
    const applicability = applicabilityFor('expository_nonfiction');
    const required = applicability.filter((row) => row.requirement === 'required').map((row) => row.featureKey);
    expect(applicability.find((row) => row.featureKey === 'character_depth')?.requirement).toBe('not_applicable');
    expect(applicability.find((row) => row.featureKey === 'character_agency')?.requirement).toBe('not_applicable');
    expect(applicability.find((row) => row.featureKey === 'relationship_focus')?.requirement).toBe('not_applicable');
    expect(applicability.find((row) => row.featureKey === 'cast_size_load')?.requirement).toBe('not_applicable');
    expect(applicability.find((row) => row.featureKey === 'multi_pov_load')?.requirement).toBe('not_applicable');
    expect(applicability.find((row) => row.featureKey === 'ending_openness')?.requirement).toBe('not_applicable');

    const result = evaluateClassificationGate({
      featureDefinitions: definitions,
      applicability,
      presentFeatureKeys: required,
      tags: [{ tagKey: 'economics', tagType: 'theme' }],
      applicableSubgenreKeys: [],
    });
    expect(result.missingRequired).toEqual([]);
    expect(result.notApplicable).toContain('character_depth');
    expect(result.passes).toBe(false); // falta tag genre
  });

  it('el gate no reclama features no aplicables; aprueba expository con genre+theme', () => {
    const applicability = applicabilityFor('expository_nonfiction');
    const required = applicability.filter((row) => row.requirement === 'required').map((row) => row.featureKey);
    const result = evaluateClassificationGate({
      featureDefinitions: definitions,
      applicability,
      presentFeatureKeys: required,
      tags: [{ tagKey: 'economics', tagType: 'theme' }, { tagKey: 'history', tagType: 'genre' }],
      applicableSubgenreKeys: [],
    });
    expect(result.missingRequired).toEqual([]);
    expect(result.passes).toBe(true);
  });

  it('feature sin regla produce error de configuración, no se asume optional', () => {
    const result = evaluateClassificationGate({
      featureDefinitions: [{ featureKey: 'mystery_feature', schemaVersion: BOOK_FEATURE_SCHEMA_VERSION }],
      applicability: [],
      presentFeatureKeys: [],
      tags: [],
      applicableSubgenreKeys: [],
    });
    expect(result.configurationErrors).toContain('mystery_feature');
    expect(result.passes).toBe(false);
  });

  it('subgenre solo se exige cuando el genre seleccionado tiene subgéneros definidos', () => {
    const applicability = applicabilityFor('fiction');
    const required = applicability.filter((row) => row.requirement === 'required').map((row) => row.featureKey);
    const withSubgenre = evaluateClassificationGate({
      featureDefinitions: definitions,
      applicability,
      presentFeatureKeys: required,
      tags: [{ tagKey: 'science_fiction', tagType: 'genre' }, { tagKey: 'identity', tagType: 'theme' }],
      applicableSubgenreKeys: ['space_opera', 'cyberpunk'],
    });
    expect(withSubgenre.passes).toBe(false);
    expect(withSubgenre.tags.subgenre).toBe(0);

    const withoutSubgenreTaxonomy = evaluateClassificationGate({
      featureDefinitions: definitions,
      applicability,
      presentFeatureKeys: required,
      tags: [{ tagKey: 'history', tagType: 'genre' }, { tagKey: 'economics', tagType: 'theme' }],
      applicableSubgenreKeys: [],
    });
    expect(withoutSubgenreTaxonomy.tags.subgenreApplicable).toBe(false);
    expect(withoutSubgenreTaxonomy.passes).toBe(true);
  });

  it('con subgéneros aplicables, añadir un subgénero permite aprobar', () => {
    const applicability = applicabilityFor('fiction');
    const required = applicability.filter((row) => row.requirement === 'required').map((row) => row.featureKey);
    const withSubgenreTag = evaluateClassificationGate({
      featureDefinitions: definitions,
      applicability,
      presentFeatureKeys: required,
      tags: [
        { tagKey: 'science_fiction', tagType: 'genre' },
        { tagKey: 'identity', tagType: 'theme' },
        { tagKey: 'space_opera', tagType: 'subgenre' },
      ],
      applicableSubgenreKeys: ['space_opera', 'cyberpunk'],
    });
    expect(withSubgenreTag.tags.subgenreApplicable).toBe(true);
    expect(withSubgenreTag.tags.subgenre).toBe(1);
    expect(withSubgenreTag.passes).toBe(true);
  });

  it('missing_required y optional_missing se distinguen', () => {
    const applicability = applicabilityFor('fiction');
    const required = applicability.filter((row) => row.requirement === 'required').map((row) => row.featureKey);
    const result = evaluateClassificationGate({
      featureDefinitions: definitions,
      applicability,
      presentFeatureKeys: required.filter((key) => key !== 'hook_speed'),
      tags: [{ tagKey: 'science_fiction', tagType: 'genre' }, { tagKey: 'identity', tagType: 'theme' }],
      applicableSubgenreKeys: ['space_opera'],
    });
    expect(result.missingRequired).toContain('hook_speed');
    expect(result.optionalMissing.length).toBeGreaterThan(0);
    expect(result.missingRequired).not.toContain('character_depth');
  });
});
