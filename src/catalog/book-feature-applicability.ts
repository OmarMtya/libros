import { BOOK_FEATURE_DEFINITIONS, BOOK_FEATURE_SCHEMA_VERSION, REQUIRED_FEATURES_SET } from './book-feature-definitions';
import { ContentTypeKey, CONTENT_TYPE_KEYS, CONTENT_TYPE_SCHEMA_VERSION } from './content-type-definitions';

export type Requirement = 'required' | 'optional' | 'not_applicable';

export type FeatureApplicabilityRow = {
  featureKey: string;
  featureSchemaVersion: string;
  contentTypeKey: string;
  contentTypeSchemaVersion: string;
  requirement: Requirement;
};

const NOT_APPLICABLE_NARRATIVE_STRUCTURE: string[] = [
  'character_depth',
  'character_agency',
  'character_likability',
  'relationship_focus',
  'cast_size_load',
  'multi_pov_load',
  'ending_openness',
  'worldbuilding_load',
];

const NOT_APPLICABLE_ESSAY: string[] = [...NOT_APPLICABLE_NARRATIVE_STRUCTURE];
const NOT_APPLICABLE_POETRY: string[] = [...NOT_APPLICABLE_NARRATIVE_STRUCTURE, 'dialogue_ratio'];

const REQUIRED_EXPOSITORY = [
  'hook_speed',
  'narrative_pace',
  'slow_burn_level',
  'narrative_payoff',
  'style_clarity',
  'ornate_prose',
  'linguistic_complexity',
  'structural_complexity',
  'conceptual_density',
  'introspection_density',
  'repetition_level',
  'descriptive_density',
  'tension_level',
];

const REQUIRED_STYLE_CORE = [
  'style_clarity',
  'ornate_prose',
  'linguistic_complexity',
  'structural_complexity',
  'conceptual_density',
  'introspection_density',
  'repetition_level',
  'descriptive_density',
];

type ContentTypeRule = { notApplicable: ReadonlySet<string>; required: ReadonlySet<string> };

const rule = (required: string[], notApplicable: string[]): ContentTypeRule => ({
  required: new Set<string>(required),
  notApplicable: new Set<string>(notApplicable),
});

export const CONTENT_TYPE_RULES: Record<ContentTypeKey, ContentTypeRule> = {
  fiction: rule([...REQUIRED_FEATURES_SET], []),
  narrative_nonfiction: rule([...REQUIRED_FEATURES_SET].filter((key) => key !== 'worldbuilding_load'), ['worldbuilding_load']),
  memoir: rule([...REQUIRED_FEATURES_SET].filter((key) => key !== 'worldbuilding_load'), ['worldbuilding_load']),
  short_stories: rule([...REQUIRED_FEATURES_SET], []),
  expository_nonfiction: rule(REQUIRED_EXPOSITORY, NOT_APPLICABLE_NARRATIVE_STRUCTURE),
  essay: rule(REQUIRED_STYLE_CORE, NOT_APPLICABLE_ESSAY),
  poetry: rule(REQUIRED_STYLE_CORE, NOT_APPLICABLE_POETRY),
  other: rule([...REQUIRED_FEATURES_SET], []),
};

export function applicabilityFor(featureKey: string, contentTypeKey: ContentTypeKey): Requirement {
  const contentRule = CONTENT_TYPE_RULES[contentTypeKey];
  if (contentRule.notApplicable.has(featureKey)) return 'not_applicable';
  if (contentRule.required.has(featureKey)) return 'required';
  return 'optional';
}

export function buildApplicabilityMatrix(): FeatureApplicabilityRow[] {
  const rows: FeatureApplicabilityRow[] = [];
  for (const definition of BOOK_FEATURE_DEFINITIONS) {
    for (const contentTypeKey of CONTENT_TYPE_KEYS) {
      rows.push({
        featureKey: definition.featureKey,
        featureSchemaVersion: BOOK_FEATURE_SCHEMA_VERSION,
        contentTypeKey,
        contentTypeSchemaVersion: CONTENT_TYPE_SCHEMA_VERSION,
        requirement: applicabilityFor(definition.featureKey, contentTypeKey),
      });
    }
  }
  return rows;
}
