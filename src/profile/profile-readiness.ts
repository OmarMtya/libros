import Decimal from 'decimal.js';

export type DimensionSignal = { key: string; value: Decimal | null; confidence: Decimal };

export const MINIMUM_SIGNAL_GROUPS = [
  ['hook_need', 'pace_preference', 'event_density_preference', 'slow_burn_tolerance', 'payoff_requirement'],
  ['character_depth_need', 'character_likability_need', 'moral_ambiguity_tolerance', 'relationship_focus_preference', 'distinct_voice_need', 'character_agency_preference'],
  ['style_clarity_preference', 'ornate_prose_tolerance', 'introspection_tolerance', 'descriptive_density_preference', 'linguistic_complexity_tolerance', 'structural_complexity_tolerance', 'conceptual_depth_appreciation', 'conceptual_density_tolerance'],
  ['tension_preference', 'comfort_preference', 'humor_preference', 'darkness_tolerance', 'emotional_intensity_preference', 'sadness_tolerance', 'strangeness_preference', 'hope_preference'],
] as const;

const isKnown = (signal: DimensionSignal | undefined) => signal !== undefined && signal.value !== null && signal.confidence.gte(0.15);

export function minimumSignalSetSatisfied(dimensions: DimensionSignal[]): boolean {
  const byKey = new Map(dimensions.map((dimension) => [dimension.key, dimension]));
  const groupsSatisfied = MINIMUM_SIGNAL_GROUPS.every((keys) => keys.some((key) => isKnown(byKey.get(key))));
  const discoveryKnown = isKnown(byKey.get('discovery_appetite'));
  const knownDimensions = dimensions.filter((dimension) => isKnown(dimension)).length;
  return groupsSatisfied && discoveryKnown && knownDimensions >= 8;
}

export type OperationalConstraints = {
  preferredPagesMin: number | null;
  preferredPagesMax: number | null;
  seriesPreference: string | null;
  acceptedLanguages: string[];
  acceptedFormats: string[];
};

export function operationalConstraintsComplete(constraints: OperationalConstraints | null): boolean {
  if (!constraints) return false;
  const validPages = Number.isInteger(constraints.preferredPagesMin) && Number.isInteger(constraints.preferredPagesMax)
    && constraints.preferredPagesMin! > 0 && constraints.preferredPagesMin! <= constraints.preferredPagesMax!;
  return validPages && Boolean(constraints.seriesPreference) && constraints.acceptedLanguages.length > 0 && constraints.acceptedFormats.length > 0;
}

export function readyToRecommend(input: {
  requiredQuestionsComplete: boolean;
  questionnaireSessionCompleted: boolean;
  dimensions: DimensionSignal[];
  constraints: OperationalConstraints | null;
  evidenceMaturity?: Decimal;
}): boolean {
  return input.requiredQuestionsComplete
    && input.questionnaireSessionCompleted
    && minimumSignalSetSatisfied(input.dimensions)
    && operationalConstraintsComplete(input.constraints);
}
