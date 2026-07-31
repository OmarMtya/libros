export type SlowBurnCompensator = {
  option_key: string;
  feature_key?: string;
  operator?: 'gte';
  threshold?: number;
  any_of?: Array<{ feature_key: string; operator: 'gte'; threshold: number }>;
};

export type SlowBurnCompensatorsRule = {
  rule_key: 'slow_burn_compensators';
  trigger: { comparison: 'book.slow_burn_level > reader.slow_burn_tolerance' };
  match_mode: 'any';
  compensators: SlowBurnCompensator[];
  effect: { zero_matches_penalty: number; one_match_penalty: number; two_or_more_matches_penalty: number };
};

export const SLOW_BURN_COMPENSATORS_RULE: SlowBurnCompensatorsRule = {
  rule_key: 'slow_burn_compensators',
  trigger: { comparison: 'book.slow_burn_level > reader.slow_burn_tolerance' },
  match_mode: 'any',
  compensators: [
    { option_key: 'tension', feature_key: 'tension_level', operator: 'gte', threshold: 0.7 },
    { option_key: 'strong_characters', feature_key: 'character_depth', operator: 'gte', threshold: 0.75 },
    { option_key: 'clear_progress', any_of: [{ feature_key: 'narrative_payoff', operator: 'gte', threshold: 0.7 }, { feature_key: 'conflict_clarity', operator: 'gte', threshold: 0.65 }] },
  ],
  effect: { zero_matches_penalty: 0.12, one_match_penalty: 0.04, two_or_more_matches_penalty: 0 },
};

export function slowBurnCompensatorsRuleFor(selectedOptions: string[]): SlowBurnCompensatorsRule {
  return {
    ...SLOW_BURN_COMPENSATORS_RULE,
    compensators: SLOW_BURN_COMPENSATORS_RULE.compensators.filter((compensator) => selectedOptions.includes(compensator.option_key)),
  };
}

export type RiskPenaltyResult = { riskPenalty: number; matchedCompensators: string[]; explanation: string };

export function slowBurnRiskPenalty(rule: SlowBurnCompensatorsRule, selectedOptions: string[], readerSlowBurnTolerance: number | null, bookFeatures: Record<string, number>): RiskPenaltyResult {
  const slowBurnLevel = bookFeatures.slow_burn_level;
  if (readerSlowBurnTolerance === null || slowBurnLevel === undefined || slowBurnLevel <= readerSlowBurnTolerance) {
    return { riskPenalty: 0, matchedCompensators: [], explanation: 'La regla de historia lenta no aplica.' };
  }
  const matchedCompensators = rule.compensators
    .filter((compensator) => selectedOptions.includes(compensator.option_key))
    .filter((compensator) => {
      if (compensator.any_of) return compensator.any_of.some((candidate) => (bookFeatures[candidate.feature_key] ?? 0) >= candidate.threshold);
      return (bookFeatures[compensator.feature_key!] ?? 0) >= compensator.threshold!;
    })
    .map((compensator) => compensator.option_key);
  const riskPenalty = matchedCompensators.length === 0
    ? rule.effect.zero_matches_penalty
    : matchedCompensators.length === 1
      ? rule.effect.one_match_penalty
      : rule.effect.two_or_more_matches_penalty;
  return {
    riskPenalty,
    matchedCompensators,
    explanation: `Historia lenta por encima de la tolerancia; ${matchedCompensators.length} compensadores configurados cumplen. Penalidad: ${riskPenalty.toFixed(2)}.`,
  };
}
