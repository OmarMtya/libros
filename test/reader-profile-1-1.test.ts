import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { slowBurnCompensatorsRuleFor, slowBurnRiskPenalty } from '../src/profile/conditional-rules';
import { DIMENSIONS, ONBOARDING_CORE_DIMENSIONS, QUESTIONS } from '../src/profile/catalog';
import { minimumSignalSetSatisfied, operationalConstraintsComplete, readyToRecommend } from '../src/profile/profile-readiness';
import { aggregateDimension } from '../src/profile/profile-calculation';

const atmosphericMappings = QUESTIONS.find((question) => question.key === 'Q06_STYLE_FRAGMENT')!.options!.find((option) => option.key === 'atmospheric')!.mappings!;
const emotionalOptions = QUESTIONS.find((question) => question.key === 'Q10_EMOTIONAL_EXPERIENCE')!.options!;
const signal = (key: string) => ({ key, value: aggregateDimension([{ dimensionKey: key, observedValue: 0.5, finalWeight: 0.6, sourceType: 'questionnaire_answer' as const, sourceId: key, createdAt: new Date() }]).value, confidence: aggregateDimension([{ dimensionKey: key, observedValue: 0.5, finalWeight: 0.6, sourceType: 'questionnaire_answer' as const, sourceId: key, createdAt: new Date() }]).confidence });

describe('reader profile 1.1 mappings and readiness', () => {
  it('keeps the approved confidence curve for 0.60 and 1.00 evidence', () => {
    const atPointSix = aggregateDimension([{ dimensionKey: 'hook_need', observedValue: 0.75, finalWeight: 0.6, sourceType: 'questionnaire_answer', sourceId: 'a', createdAt: new Date() }]);
    const atOne = aggregateDimension([{ dimensionKey: 'hook_need', observedValue: 0.75, finalWeight: 1, sourceType: 'questionnaire_answer', sourceId: 'a', createdAt: new Date() }]);
    expect(atPointSix.confidence.toFixed(4)).toBe('0.1813');
    expect(atOne.confidence.toFixed(4)).toBe('0.2835');
  });

  it('maps atmospheric style to four evidence vectors with configured specificity', () => {
    expect(atmosphericMappings).toHaveLength(4);
    expect(atmosphericMappings.map((mapping) => mapping.dimensionKey)).toEqual(['descriptive_density_preference', 'ornate_prose_tolerance', 'style_clarity_preference', 'introspection_tolerance']);
    expect(atmosphericMappings.map((mapping) => mapping.specificityFactor)).toEqual([1, 0.7, 0.6, 0.5]);
  });

  it('does not infer strangeness or mystery from curiosity, or introspection from reflection', () => {
    const curiosity = emotionalOptions.find((option) => option.key === 'curiosity')!.mappings!;
    const reflection = emotionalOptions.find((option) => option.key === 'reflection')!.mappings!;
    expect(curiosity.map((mapping) => mapping.dimensionKey)).toEqual([undefined]);
    expect(curiosity[0]!.positiveTrigger).toBe('curiosity_drive');
    expect(reflection.map((mapping) => mapping.dimensionKey)).toEqual(['conceptual_depth_appreciation']);
  });

  it('creates and evaluates the selected slow-burn compensator rule', () => {
    const rule = slowBurnCompensatorsRuleFor(['tension', 'strong_characters', 'clear_progress']);
    expect(rule.compensators.map((item) => item.option_key)).toEqual(['tension', 'strong_characters', 'clear_progress']);
    expect(slowBurnRiskPenalty(rule, ['tension', 'strong_characters', 'clear_progress'], 0.25, { slow_burn_level: 0.8 }).riskPenalty).toBe(0.12);
    expect(slowBurnRiskPenalty(rule, ['tension', 'strong_characters', 'clear_progress'], 0.25, { slow_burn_level: 0.8, tension_level: 0.8 }).riskPenalty).toBe(0.04);
    expect(slowBurnRiskPenalty(rule, ['tension', 'strong_characters', 'clear_progress'], 0.25, { slow_burn_level: 0.8, tension_level: 0.8, character_depth: 0.8 }).riskPenalty).toBe(0);
  });

  it('requires all minimum signal groups and operational constraints, not maturity', () => {
    const complete = ['hook_need', 'character_depth_need', 'style_clarity_preference', 'tension_preference', 'discovery_appetite', 'open_ending_tolerance', 'slow_burn_tolerance', 'moral_ambiguity_tolerance'].map(signal);
    const constraints = { preferredPagesMin: 100, preferredPagesMax: 400, seriesPreference: 'standalone_only', acceptedLanguages: ['es'], acceptedFormats: ['physical'] };
    expect(minimumSignalSetSatisfied(complete)).toBe(true);
    expect(operationalConstraintsComplete(constraints)).toBe(true);
    expect(readyToRecommend({ requiredQuestionsComplete: true, questionnaireSessionCompleted: true, dimensions: complete, constraints, evidenceMaturity: aggregateDimension([]).confidence })).toBe(true);
    expect(readyToRecommend({ requiredQuestionsComplete: false, questionnaireSessionCompleted: true, dimensions: complete, constraints })).toBe(false);
    expect(readyToRecommend({ requiredQuestionsComplete: true, questionnaireSessionCompleted: true, dimensions: complete.filter((item) => item.key !== 'tension_preference'), constraints })).toBe(false);
    expect(readyToRecommend({ requiredQuestionsComplete: true, questionnaireSessionCompleted: true, dimensions: complete, constraints: null })).toBe(false);
    expect(minimumSignalSetSatisfied(complete.slice(0, 7))).toBe(false);
    expect(operationalConstraintsComplete({ ...constraints, acceptedFormats: [] })).toBe(false);
  });

  it('keeps one source of truth for core and runtime dimension invariants', () => {
    const keys = DIMENSIONS.map((dimension) => dimension.key);
    const numeric = DIMENSIONS.filter((dimension) => dimension.dimensionKind !== 'selection_control');
    const controls = DIMENSIONS.filter((dimension) => dimension.dimensionKind === 'selection_control');
    const known = [...ONBOARDING_CORE_DIMENSIONS].filter((key) => key === 'hook_need');
    const missing = [...ONBOARDING_CORE_DIMENSIONS].filter((key) => key !== 'hook_need');
    const mappings = QUESTIONS.flatMap((question) => question.options ?? []).flatMap((option) => option.mappings ?? []).filter((mapping) => mapping.dimensionKey);
    const specification = readFileSync('reader_profile_spec.md', 'utf8');

    expect(keys).toHaveLength(43);
    expect(numeric).toHaveLength(39);
    expect(controls).toHaveLength(4);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...ONBOARDING_CORE_DIMENSIONS].every((key) => keys.includes(key))).toBe(true);
    expect(known.length + missing.length).toBe(ONBOARDING_CORE_DIMENSIONS.size);
    expect(mappings.every((mapping) => keys.includes(mapping.dimensionKey!))).toBe(true);
    expect(DIMENSIONS.every((dimension) => dimension.domainKey && dimension.dimensionKind && dimension.matchingOperator && dimension.bookFeatureKey)).toBe(true);
    expect(specification).toContain('39 numeric dimensions and 4 discovery selection controls (43 active keys total)');
  });
});
