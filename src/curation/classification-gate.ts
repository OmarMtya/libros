import { Requirement } from '../catalog';

export type GateFeatureDefinition = {
  featureKey: string;
  schemaVersion: string;
};

export type GateApplicabilityRow = {
  featureKey: string;
  requirement: Requirement;
};

export type GateTagSignal = {
  tagKey: string;
  tagType: string;
};

export type ClassificationDiagnostics = {
  missingRequired: string[];
  optionalMissing: string[];
  notApplicable: string[];
  configurationErrors: string[];
  featureCoverageRatio: number | null;
  tags: { genre: number; theme: number; subgenre: number; subgenreApplicable: boolean };
  passes: boolean;
};

export type GateInput = {
  featureDefinitions: GateFeatureDefinition[];
  applicability: GateApplicabilityRow[];
  presentFeatureKeys: string[];
  tags: GateTagSignal[];
  applicableSubgenreKeys: string[];
};

const REQ = { required: 'required', optional: 'optional', not_applicable: 'not_applicable' } as const;

export function evaluateClassificationGate(input: GateInput): ClassificationDiagnostics {
  const applicabilityByKey = new Map<string, Requirement>(input.applicability.map((row) => [row.featureKey, row.requirement]));
  const present = new Set<string>(input.presentFeatureKeys);

  const configurationErrors: string[] = [];
  const missingRequired: string[] = [];
  const optionalMissing: string[] = [];
  const notApplicable: string[] = [];

  for (const definition of input.featureDefinitions) {
    const requirement = applicabilityByKey.get(definition.featureKey);
    if (!requirement) {
      configurationErrors.push(definition.featureKey);
      continue;
    }
    if (requirement === REQ.not_applicable) {
      notApplicable.push(definition.featureKey);
      continue;
    }
    if (requirement === REQ.required && !present.has(definition.featureKey)) {
      missingRequired.push(definition.featureKey);
      continue;
    }
    if (requirement === REQ.optional && !present.has(definition.featureKey)) {
      optionalMissing.push(definition.featureKey);
    }
  }

  const applicableTotal = input.featureDefinitions.filter((definition) => {
    const requirement = applicabilityByKey.get(definition.featureKey);
    return requirement === REQ.required || requirement === REQ.optional;
  }).length;

  const presentApplicable = input.featureDefinitions.filter((definition) => {
    const requirement = applicabilityByKey.get(definition.featureKey);
    return (requirement === REQ.required || requirement === REQ.optional) && present.has(definition.featureKey);
  }).length;

  const featureCoverageRatio = applicableTotal === 0 ? null : Number((presentApplicable / applicableTotal).toFixed(4));

  const genres = input.tags.filter((tag) => tag.tagType === 'genre').length;
  const themes = input.tags.filter((tag) => tag.tagType === 'theme').length;
  const subgenres = input.tags.filter((tag) => tag.tagType === 'subgenre').length;
  const subgenreApplicable = input.applicableSubgenreKeys.length > 0;

  const tagsOk = genres >= 1 && themes >= 1 && (!subgenreApplicable || subgenres >= 1);

  return {
    missingRequired,
    optionalMissing,
    notApplicable,
    configurationErrors,
    featureCoverageRatio,
    tags: { genre: genres, theme: themes, subgenre: subgenres, subgenreApplicable },
    passes: configurationErrors.length === 0 && missingRequired.length === 0 && tagsOk,
  };
}
