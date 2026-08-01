import Decimal from 'decimal.js';
import { DimensionKind } from '@prisma/client';
import { DIMENSIONS } from '../profile/catalog';
import { BOOK_FEATURE_DEFINITIONS } from '../catalog/book-feature-definitions';
import { clamp01 } from '../scoring/compatibility';

export type LearningOperation =
  | 'reinforce_near_book_value'
  | 'prefer_above_book_value'
  | 'prefer_below_book_value'
  | 'tolerance_below_failure_point'
  | 'requirement_above_book_value';

export type LearningMapping = {
  targetDimension: string;
  bookFeatureKey: string;
  operation: LearningOperation;
  margin: number;
  baseWeight: number;
  reasonCode: string;
};

export const LEARNING_MAPPING_VERSION = 'feedback-learning/1.0';

export const FEEDBACK_LEARNING_MAPPINGS: Record<'positive' | 'negative', Record<string, LearningMapping[]>> = {
  positive: {
    story_progress: [{ targetDimension: 'payoff_requirement', bookFeatureKey: 'narrative_payoff', operation: 'reinforce_near_book_value', margin: 0, baseWeight: 1.4, reasonCode: 'f05_story_progress_learn' }],
    tension_curiosity: [
      { targetDimension: 'tension_preference', bookFeatureKey: 'tension_level', operation: 'reinforce_near_book_value', margin: 0, baseWeight: 1.4, reasonCode: 'f05_tension_learn' },
    ],
    characters: [
      { targetDimension: 'character_depth_need', bookFeatureKey: 'character_depth', operation: 'reinforce_near_book_value', margin: 0, baseWeight: 1.4, reasonCode: 'f05_characters_learn' },
      { targetDimension: 'character_agency_preference', bookFeatureKey: 'character_agency', operation: 'reinforce_near_book_value', margin: 0, baseWeight: 1.4, reasonCode: 'f05_agency_learn' },
    ],
    character_relationships: [{ targetDimension: 'relationship_focus_preference', bookFeatureKey: 'relationship_focus', operation: 'reinforce_near_book_value', margin: 0, baseWeight: 1.4, reasonCode: 'f05_relationships_learn' }],
    writing_style: [{ targetDimension: 'style_clarity_preference', bookFeatureKey: 'style_clarity', operation: 'reinforce_near_book_value', margin: 0, baseWeight: 1.4, reasonCode: 'f05_style_clarity_learn' }],
    ideas_reflection: [
      { targetDimension: 'conceptual_depth_appreciation', bookFeatureKey: 'conceptual_depth', operation: 'reinforce_near_book_value', margin: 0, baseWeight: 1.4, reasonCode: 'f05_ideas_learn' },
      { targetDimension: 'introspection_tolerance', bookFeatureKey: 'introspection_density', operation: 'reinforce_near_book_value', margin: 0, baseWeight: 1.4, reasonCode: 'f05_reflection_learn' },
    ],
    atmosphere: [],
    emotional_effect: [{ targetDimension: 'emotional_intensity_preference', bookFeatureKey: 'emotional_intensity', operation: 'reinforce_near_book_value', margin: 0, baseWeight: 1.4, reasonCode: 'f05_emotional_effect_learn' }],
    setting_world: [{ targetDimension: 'worldbuilding_load_tolerance', bookFeatureKey: 'worldbuilding_load', operation: 'reinforce_near_book_value', margin: 0, baseWeight: 1.4, reasonCode: 'f05_setting_learn' }],
    length: [],
    nothing_in_particular: [],
    other: [],
  },
  negative: {
    slow_without_payoff: [
      { targetDimension: 'slow_burn_tolerance', bookFeatureKey: 'slow_burn_level', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_slow_no_payoff_learn' },
      { targetDimension: 'payoff_requirement', bookFeatureKey: 'narrative_payoff', operation: 'requirement_above_book_value', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_payoff_required_learn' },
    ],
    too_fast_superficial: [
      { targetDimension: 'event_density_preference', bookFeatureKey: 'event_density', operation: 'prefer_below_book_value', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_too_fast_superficial_learn' },
      { targetDimension: 'character_depth_need', bookFeatureKey: 'character_depth', operation: 'requirement_above_book_value', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_too_fast_depth_learn' },
    ],
    confusing: [
      { targetDimension: 'linguistic_complexity_tolerance', bookFeatureKey: 'linguistic_complexity', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_confusing_learn' },
      { targetDimension: 'structural_complexity_tolerance', bookFeatureKey: 'structural_complexity', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_confusing_structural_learn' },
    ],
    too_many_voices_names_jumps: [
      { targetDimension: 'multi_pov_tolerance', bookFeatureKey: 'multi_pov_load', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_too_many_pov_learn' },
      { targetDimension: 'cast_size_tolerance', bookFeatureKey: 'cast_size_load', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_cast_size_learn' },
    ],
    characters_no_connection: [
      { targetDimension: 'character_likability_need', bookFeatureKey: 'character_likability', operation: 'requirement_above_book_value', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_no_connection_learn' },
      { targetDimension: 'relationship_focus_preference', bookFeatureKey: 'relationship_focus', operation: 'prefer_above_book_value', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_no_relationships_learn' },
    ],
    characters_too_similar: [{ targetDimension: 'distinct_voice_need', bookFeatureKey: 'voice_distinctiveness', operation: 'requirement_above_book_value', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_too_similar_voices_learn' }],
    style_too_simple: [
      { targetDimension: 'ornate_prose_tolerance', bookFeatureKey: 'ornate_prose', operation: 'prefer_above_book_value', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_style_too_simple_ornate_learn' },
      { targetDimension: 'linguistic_complexity_tolerance', bookFeatureKey: 'linguistic_complexity', operation: 'prefer_above_book_value', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_style_too_simple_language_learn' },
    ],
    style_too_ornate: [
      { targetDimension: 'style_clarity_preference', bookFeatureKey: 'style_clarity', operation: 'prefer_above_book_value', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_style_too_ornate_clarity_learn' },
      { targetDimension: 'ornate_prose_tolerance', bookFeatureKey: 'ornate_prose', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_too_ornate_learn' },
    ],
    too_much_introspection: [{ targetDimension: 'introspection_tolerance', bookFeatureKey: 'introspection_density', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_too_much_introspection_learn' }],
    repetitive: [{ targetDimension: 'repetition_tolerance', bookFeatureKey: 'repetition_level', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_repetitive_learn' }],
    too_demanding: [
      { targetDimension: 'linguistic_complexity_tolerance', bookFeatureKey: 'linguistic_complexity', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_too_demanding_ling_learn' },
      { targetDimension: 'structural_complexity_tolerance', bookFeatureKey: 'structural_complexity', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_too_demanding_struct_learn' },
      { targetDimension: 'conceptual_density_tolerance', bookFeatureKey: 'conceptual_density', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_too_demanding_conceptual_learn' },
    ],
    ending_unsatisfying: [{ targetDimension: 'open_ending_tolerance', bookFeatureKey: 'ending_openness', operation: 'tolerance_below_failure_point', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_ending_unsatisfying_learn' }],
    nothing_important: [{ targetDimension: 'payoff_requirement', bookFeatureKey: 'narrative_payoff', operation: 'requirement_above_book_value', margin: 0.15, baseWeight: 1.5, reasonCode: 'f06_nothing_important_learn' }],
    topic_no_interest: [],
    length_problem: [],
    other: [],
  },
};

export function observedValueFor(operation: LearningOperation, bookValue: Decimal.Value, margin: number): Decimal {
  const book = new Decimal(bookValue);
  switch (operation) {
    case 'reinforce_near_book_value':
    case 'prefer_above_book_value':
    case 'requirement_above_book_value':
      return clamp01(book.plus(margin));
    case 'prefer_below_book_value':
    case 'tolerance_below_failure_point':
      return clamp01(book.minus(margin));
    default:
      return clamp01(book);
  }
}

const DIMENSION_KIND_BY_KEY = new Map(DIMENSIONS.map((dimension) => [dimension.key, dimension.dimensionKind]));
const FEATURE_KEYS = new Set(BOOK_FEATURE_DEFINITIONS.map((definition) => definition.featureKey));

const ALLOWED_OPERATIONS: Record<DimensionKind, LearningOperation[]> = {
  target: ['reinforce_near_book_value', 'prefer_above_book_value', 'prefer_below_book_value'],
  minimum_required: ['requirement_above_book_value', 'reinforce_near_book_value'],
  maximum_tolerated: ['tolerance_below_failure_point', 'prefer_below_book_value', 'prefer_above_book_value', 'reinforce_near_book_value'],
  importance: ['reinforce_near_book_value', 'prefer_above_book_value', 'prefer_below_book_value'],
  selection_control: [],
};

export function validateLearningMappings(): string[] {
  const problems: string[] = [];
  for (const polarity of ['positive', 'negative'] as const) {
    for (const [optionKey, mappings] of Object.entries(FEEDBACK_LEARNING_MAPPINGS[polarity])) {
      for (const mapping of mappings) {
        const kind = DIMENSION_KIND_BY_KEY.get(mapping.targetDimension);
        if (!kind) {
          problems.push(`${polarity}/${optionKey}: dimensión desconocida ${mapping.targetDimension}`);
          continue;
        }
        if (!FEATURE_KEYS.has(mapping.bookFeatureKey)) {
          problems.push(`${polarity}/${optionKey}: feature desconocida ${mapping.bookFeatureKey}`);
        }
        if (mapping.margin < 0 || mapping.margin > 0.3) {
          problems.push(`${polarity}/${optionKey}: margen fuera de rango ${mapping.margin}`);
        }
        if (!ALLOWED_OPERATIONS[kind].includes(mapping.operation)) {
          problems.push(`${polarity}/${optionKey}: operación ${mapping.operation} incoherente con ${mapping.targetDimension} (${kind})`);
        }
      }
    }
  }
  return problems;
}
