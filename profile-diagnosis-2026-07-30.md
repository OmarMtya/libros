# Reproducible Profile Diagnosis

This report is read-only. It describes the persisted onboarding session and the code that produced its profile. No formulas, source code, or database rows were changed while preparing it.

## Scope

- Profile ID: `15c69d42-f44d-49bf-aa36-c0512bf4d288`
- Completed session ID: `0615ceb5-2cb9-4d03-bc84-53320cdf3d37`
- Questionnaire version: `onboarding/1.0`
- Profile schema version: `reader-profile/1.1.1`
- Calculation version: `prof-calc/1.0`
- Classifier version: `book-tax/1.1.0`
- Tag taxonomy version: `tag-tax/1.0.1`

Persisted result:

```text
profile_version             = 9
ready_to_recommend          = false
onboarding_core_coverage    = 0.5833
evidence_maturity           = 0.2542
global_profile_coverage     = 0.3256
```

## 1. Processed Answers

All 15 answers have `question_version = 1` and `questionnaire_version = onboarding/1.0`.

| Question key | Raw response | Normalized response |
|---|---|---|
| `Q01_LOVED_BOOKS` | `{"books":[{"title":"La pacient silenciosa","authors":["Alex Michaelides"],"coverUrl":"https://covers.openlibrary.org/b/id/15242046-M.jpg","openLibraryId":"OL19096402W","firstPublishYear":2018,"openLibraryEditionId":"OL47457228M"},{"title":"Harry Potter y la piedra filosofal","authors":["J. K. Rowling"],"coverUrl":"https://covers.openlibrary.org/b/id/14925450-M.jpg","openLibraryId":"OL82563W","firstPublishYear":1997,"openLibraryEditionId":"OL38565767M"},{"title":"Segunda Variedad, La - Cuentos Completos 2","authors":["Philip K. Dick"],"coverUrl":null,"openLibraryId":"OL2172437W","firstPublishYear":1993,"openLibraryEditionId":"OL9139437M"}]}` | Same books, without `openLibraryEditionId` fields |
| `Q02_DISLIKED_BOOK` | `{"books":[{"title":"Principios","authors":["Ray Dalio","Manuel Manzano"],"coverUrl":"https://covers.openlibrary.org/b/id/13121083-M.jpg","openLibraryId":"OL33190967W","firstPublishYear":2018,"openLibraryEditionId":"OL45075749M"}],"reason":"Demasiado denso"}` | Same book, without `openLibraryEditionId`; reason remains `Demasiado denso` |
| `Q03_PRIORITY_RANKING` | `["characters","atmosphere","plot"]` | `{"ranking":["characters","atmosphere","plot"]}` |
| `Q04_HOOK_NEED` | `4` | `{"value":0.75}` |
| `Q05_SLOW_BURN_TOLERANCE` | `2` | `{"value":0.25}` |
| `Q05A_SLOW_BURN_CONDITIONS` | `["tension","strong_characters","clear_progress"]` | `{"optionKeys":["tension","strong_characters","clear_progress"]}` |
| `Q06_STYLE_FRAGMENT` | `"atmospheric"` | `{"optionKeys":["atmospheric"]}` |
| `Q07_COMPLEXITY` | `{"linguistic":2,"structural":3}` | `{"linguistic":0.25,"structural":0.5}` |
| `Q08_ENDING_PREFERENCE` | `"resolved_with_interpretation"` | `{"optionKeys":["resolved_with_interpretation"]}` |
| `Q09_CHARACTER_PREFERENCES` | `["morally_ambiguous","psychologically_deep","competent"]` | `{"optionKeys":["morally_ambiguous","psychologically_deep","competent"]}` |
| `Q10_EMOTIONAL_EXPERIENCE` | `["tension","curiosity","reflection"]` | `{"optionKeys":["tension","curiosity","reflection"]}` |
| `Q11_GENRES_THEMES` | `{"liked":["science_fiction","economics","psychological_thriller","psychological_horror","horror"],"curious":["comedy","war","romance"],"notInterested":["alternate_history","satire","migration"]}` | Same payload |
| `Q12_LENGTH_SERIES` | `{"maxPages":400,"minPages":100,"seriesPreference":"standalone_only"}` | Same payload |
| `Q13_FORMAT_LANGUAGE` | `{"languages":["spanish","english"]}` | Same payload |
| `Q14_DISCOVERY_APPETITE` | `2` | `{"value":0.25}` |

## 2. Applied Mappings

Standard mappings are defined by `QUESTIONS` in `src/profile/catalog.ts` and seeded into `question_option_mappings.evidence_mappings_json` by `prisma/seed.ts:32-43`.

| Question | Option | Dimension or tag | Observed value | Base weight | Reason code |
|---|---|---|---:|---:|---|
| Q04 | `scale` | `hook_need` | 0.75 | 0.60 | `q04_hook_need` |
| Q05 | `scale` | `slow_burn_tolerance` | 0.25 | 0.60 | `q05_slow_burn` |
| Q06 | `atmospheric` | `descriptive_density_preference` | 0.85 | 1.00 | `q06_atmosphere_description` |
| Q07 | structured | `linguistic_complexity_tolerance` | 0.25 | 0.60 | `q07_linguistic_complexity` |
| Q07 | structured | `structural_complexity_tolerance` | 0.50 | 0.60 | `q07_structural_complexity` |
| Q08 | `resolved_with_interpretation` | `open_ending_tolerance` | 0.40 | 0.60 | `q08_resolved` |
| Q09 | `competent` | `character_agency_preference` | 0.85 | 0.60 | `q09_character_competent` |
| Q09 | `psychologically_deep` | `character_depth_need` | 0.90 | 0.60 | `q09_character_psychologically_deep` |
| Q09 | `morally_ambiguous` | `moral_ambiguity_tolerance` | 0.85 | 0.60 | `q09_character_morally_ambiguous` |
| Q10 | `tension` | `tension_preference` | 0.85 | 0.60 | `q10_emotion_tension` |
| Q10 | `curiosity` | `strangeness_preference` | 0.60 | 0.60 | `q10_emotion_curiosity` |
| Q10 | `curiosity` | tag `mystery` | N/A | 0.60 | `q10_emotion_curiosity_tag` |
| Q10 | `reflection` | `introspection_tolerance` | 0.70 | 0.60 | `q10_emotion_reflection` |
| Q10 | `reflection` | `conceptual_depth_appreciation` | 0.65 | 0.60 | `q10_emotion_reflection_ideas` |
| Q14 | `scale` | `discovery_appetite` | 0.25 | 0.60 | `q14_discovery_appetite` |

`Q07` is hardcoded in `QuestionnaireService.resolveMappings()` at `src/questionnaire/questionnaire.service.ts:137-141`.

`Q01`, `Q02`, `Q03`, `Q05A`, `Q11`, `Q12`, and `Q13` create no numeric evidence. Q11 creates `reader_tag_preferences`; its like, curious, and not-interested affinities are defined in `QuestionnaireService.tagSelections()` at lines 166-171.

## 3. Generated Evidence

Every row has `source_type = questionnaire_answer`, `exposure_factor = 1.0000`, `specificity_factor = 1.0000`, and `attribution_factor = 1.0000`.

| Dimension key | Source ID | Observed | Base | Final | Reason code | Evidence fingerprint |
|---|---|---:|---:|---:|---|---|
| `character_agency_preference` | `c7891265-ce18-421b-b6a1-22f7a3ff114c` | 0.8500 | 0.6000 | 0.6000 | `q09_character_competent` | `260aaced1635c52237a588fefb978a2b73c00cf32d42e3cf8a5148c77ecf2da1` |
| `character_depth_need` | `c7891265-ce18-421b-b6a1-22f7a3ff114c` | 0.9000 | 0.6000 | 0.6000 | `q09_character_psychologically_deep` | `7019f47031017f67dcdd68092a03d4b8982928568c11ed43208ed2fd1225174b` |
| `conceptual_depth_appreciation` | `e9439f86-78aa-4aa9-81cd-3b1c42950d49` | 0.6500 | 0.6000 | 0.6000 | `q10_emotion_reflection_ideas` | `892c82d0d1513e2eae37187cb513150ff48b2a7c512140b17949cbeddfe3c711` |
| `descriptive_density_preference` | `fa9c6396-aba1-45b4-a8e9-3b765749350d` | 0.8500 | 1.0000 | 1.0000 | `q06_atmosphere_description` | `6fad665301729f37422bc8680415f3cec77572defe86b78a46aad9fdb5bb97d7` |
| `discovery_appetite` | `912081f6-af6c-4855-ac1f-a053f9ef645d` | 0.2500 | 0.6000 | 0.6000 | `q14_discovery_appetite` | `8312b0766b7fad3dc0ceae24721120e1e508ad0d2fddcb0446c3b48aadde4d4b` |
| `hook_need` | `31e3dd4e-6072-449b-a2ac-98e24ed41ee1` | 0.7500 | 0.6000 | 0.6000 | `q04_hook_need` | `d681eb0180e222681da3e5a5b5462a802644c03becd2b868a49f92771cc3d89a` |
| `introspection_tolerance` | `e9439f86-78aa-4aa9-81cd-3b1c42950d49` | 0.7000 | 0.6000 | 0.6000 | `q10_emotion_reflection` | `051815ec23343490b845183a4da6adce2af00641968c8a02dc044d28936c1546` |
| `linguistic_complexity_tolerance` | `899c4334-76b0-4371-928a-5e54af3166b6` | 0.2500 | 0.6000 | 0.6000 | `q07_linguistic_complexity` | `c4979aae6e64680015e29a3aa074495a9511b121257cecc467b2db98efb047e8` |
| `moral_ambiguity_tolerance` | `c7891265-ce18-421b-b6a1-22f7a3ff114c` | 0.8500 | 0.6000 | 0.6000 | `q09_character_morally_ambiguous` | `27f54438f216dd3de811cdb744a6b612b0e5cea650962da6cdd151bb8f0e7823` |
| `open_ending_tolerance` | `529ea92b-4d0a-4b55-be27-a78010d19f6a` | 0.4000 | 0.6000 | 0.6000 | `q08_resolved` | `fbec8eb86e518585ebd7f6fce1d0b2a3d09043806ac0936a352d3ec5bbebb500` |
| `slow_burn_tolerance` | `d398e7b3-d86a-4061-9453-e84723fa878d` | 0.2500 | 0.6000 | 0.6000 | `q05_slow_burn` | `2472ee4db23cbb684df0a869779b393a4ec0c4305d6d7c82db876455ce77bf87` |
| `strangeness_preference` | `e9439f86-78aa-4aa9-81cd-3b1c42950d49` | 0.6000 | 0.6000 | 0.6000 | `q10_emotion_curiosity` | `bfcb30db71c2188d8f653c61a1a18f32242270fcf43b3d74993be9345fcd534c` |
| `structural_complexity_tolerance` | `899c4334-76b0-4371-928a-5e54af3166b6` | 0.5000 | 0.6000 | 0.6000 | `q07_structural_complexity` | `6a41ed8a039abcc5a0dbd6efa5653a6ae0838a8b955e4304e695fc18e012ff01` |
| `tension_preference` | `e9439f86-78aa-4aa9-81cd-3b1c42950d49` | 0.8500 | 0.6000 | 0.6000 | `q10_emotion_tension` | `7b785dc3c176c884b6c91f2a01cb34fda1fb386e6a3408b0078f0f37dfb60443` |

## 4. Value Aggregation

Implementation: `aggregateDimension()` in `src/profile/profile-calculation.ts:25-48`.

```ts
const totalWeight = evidence.reduce((sum, item) => sum.plus(item.finalWeight), new Decimal(0));
const value = evidence.reduce(
  (sum, item) => sum.plus(new Decimal(item.finalWeight).mul(item.observedValue)),
  new Decimal(0),
).div(totalWeight);
```

| Dimension | Input | Numerator | Denominator | Value before rounding | Persisted |
|---|---|---:|---:|---:|---:|
| `character_agency_preference` | `0.8500@0.6000` | 0.51000000 | 0.6000 | 0.85000000000000000000 | 0.8500 |
| `character_depth_need` | `0.9000@0.6000` | 0.54000000 | 0.6000 | 0.90000000000000000000 | 0.9000 |
| `conceptual_depth_appreciation` | `0.6500@0.6000` | 0.39000000 | 0.6000 | 0.65000000000000000000 | 0.6500 |
| `descriptive_density_preference` | `0.8500@1.0000` | 0.85000000 | 1.0000 | 0.85000000000000000000 | 0.8500 |
| `discovery_appetite` | `0.2500@0.6000` | 0.15000000 | 0.6000 | 0.25000000000000000000 | 0.2500 |
| `hook_need` | `0.7500@0.6000` | 0.45000000 | 0.6000 | 0.75000000000000000000 | 0.7500 |
| `introspection_tolerance` | `0.7000@0.6000` | 0.42000000 | 0.6000 | 0.70000000000000000000 | 0.7000 |
| `linguistic_complexity_tolerance` | `0.2500@0.6000` | 0.15000000 | 0.6000 | 0.25000000000000000000 | 0.2500 |
| `moral_ambiguity_tolerance` | `0.8500@0.6000` | 0.51000000 | 0.6000 | 0.85000000000000000000 | 0.8500 |
| `open_ending_tolerance` | `0.4000@0.6000` | 0.24000000 | 0.6000 | 0.40000000000000000000 | 0.4000 |
| `slow_burn_tolerance` | `0.2500@0.6000` | 0.15000000 | 0.6000 | 0.25000000000000000000 | 0.2500 |
| `strangeness_preference` | `0.6000@0.6000` | 0.36000000 | 0.6000 | 0.60000000000000000000 | 0.6000 |
| `structural_complexity_tolerance` | `0.5000@0.6000` | 0.30000000 | 0.6000 | 0.50000000000000000000 | 0.5000 |
| `tension_preference` | `0.8500@0.6000` | 0.51000000 | 0.6000 | 0.85000000000000000000 | 0.8500 |

## 5. Confidence Aggregation

Implementation: `src/profile/profile-calculation.ts:32-43`.

```ts
const variance = weightedSquaredDistance.div(totalWeight);
const consistency = Decimal.max(0, Decimal.min(1, new Decimal(1).minus(variance.div(0.25))));
const maturity = new Decimal(1).minus(new Decimal(-1).mul(totalWeight).div(3).exp());
let confidence = maturity.mul(new Decimal(0.4).plus(new Decimal(0.6).mul(consistency)));
confidence = Decimal.min(confidence, feedbackSources.size >= 3 ? 0.95 : feedbackSources.size > 0 ? 0.85 : 0.55);
```

For each of the 13 dimensions with one evidence row of final weight `0.6000`:

```text
variance = 0.6000 * (value - value)^2 / 0.6000 = 0
consistency = 1 - 0 / 0.25 = 1
maturity = 1 - exp(-0.6000 / 3)
         = 1 - exp(-0.2)
         = 0.18126924692201818
confidence_raw = 0.18126924692201818 * (0.4 + 0.6 * 1)
               = 0.18126924692201818
confidence_after_cap = min(0.18126924692201818, 0.55)
                     = 0.18126924692201818
confidence_persisted = 0.1813
```

For `descriptive_density_preference`, whose total evidence weight is `1.0000`:

```text
variance = 1.0000 * (0.8500 - 0.8500)^2 / 1.0000 = 0
consistency = 1
maturity = 1 - exp(-1.0000 / 3)
         = 1 - exp(-0.3333333333333333)
         = 0.28346868942621073
confidence_raw = 0.28346868942621073 * (0.4 + 0.6 * 1)
               = 0.28346868942621073
confidence_after_cap = min(0.28346868942621073, 0.55)
                     = 0.28346868942621073
confidence_persisted = 0.2835
```

No `reading_feedback` evidence exists, so the applicable confidence cap is `0.55`; it does not alter either result.

## 6. Onboarding Core Coverage

The denominator is **12**, not 24. The source is `ONBOARDING_CORE_DIMENSIONS` in `src/profile/catalog.ts:49-54`.

The coverage rule in `ProfileService.recompute()` is:

```ts
item.aggregate.value !== null && item.aggregate.confidence.gte(0.15)
```

Known core dimensions:

```text
character_depth_need            0.9000 / 0.1813
conceptual_depth_appreciation   0.6500 / 0.1813
hook_need                       0.7500 / 0.1813
linguistic_complexity_tolerance 0.2500 / 0.1813
moral_ambiguity_tolerance       0.8500 / 0.1813
open_ending_tolerance           0.4000 / 0.1813
tension_preference              0.8500 / 0.1813
```

Missing core dimensions:

```text
comfort_preference
ornate_prose_tolerance
pace_preference
style_clarity_preference
```

```text
numerator = 7
denominator = 12
coverage_before_rounding = 7 / 12 = 0.5833333333333333
onboarding_core_coverage = round(4) = 0.5833
```

## 7. Evidence Maturity

Implementation: `src/profile/profile.service.ts:79-80`.

```ts
const maturity = Decimal.min(
  0.95,
  new Decimal(1).minus(new Decimal(-1).mul(totalWeight).div(30).exp()),
);
```

```text
total_evidence_weight = 13 * 0.6000 + 1 * 1.0000 = 8.8000
evidence_maturity_before_rounding = 1 - exp(-8.8000 / 30)
                                   = 1 - exp(-0.2933333333333333)
                                   = 0.25422649190860783789
evidence_maturity = round(4) = 0.2542
```

The dimension confidence formula uses divisor `3`; the profile-wide evidence maturity metric uses divisor `30`.

## 8. Ready To Recommend

The implemented rule in `src/profile/profile.service.ts:51-54` and `102` is:

```ts
const requiredComplete = await this.hasCompletedRequiredQuestions(tx, userId);
const ready = requiredComplete && coreCoverage.gte(0.7);
```

| Predicate | Result | Detail |
|---|---:|---|
| Completed questionnaire session | true | Session status is `completed` |
| All required questions answered | true | 8 required questions, all answered |
| `onboarding_core_coverage >= 0.70` | false | `0.5833 >= 0.70` is false |
| Minimum signal set | Not implemented | No predicate exists |
| Operational constraints complete | Not implemented | No predicate exists |
| Evidence maturity gate | Not used | Not part of the expression |
| Global profile coverage gate | Not used | Not part of the expression |

```text
ready_to_recommend = true AND false = false
```

## 9. Profile Versions

| Version | Created at | Change reason | Source ID | Evidence count |
|---:|---|---|---|---:|
| 1 | `2026-07-30 22:49:05.970+00` | `questionnaire_answer` | `16dad7ff-38bc-438a-83ea-bfbd61f05739` | 0 |
| 2 | `2026-07-30 22:49:56.301+00` | `questionnaire_answer` | `31e3dd4e-6072-449b-a2ac-98e24ed41ee1` | 1 |
| 3 | `2026-07-30 22:50:02.852+00` | `questionnaire_answer` | `d398e7b3-d86a-4061-9453-e84723fa878d` | 2 |
| 4 | `2026-07-30 22:50:26.463+00` | `questionnaire_answer` | `fa9c6396-aba1-45b4-a8e9-3b765749350d` | 3 |
| 5 | `2026-07-30 22:50:31.245+00` | `questionnaire_answer` | `899c4334-76b0-4371-928a-5e54af3166b6` | 5 |
| 6 | `2026-07-30 22:50:45.375+00` | `questionnaire_answer` | `529ea92b-4d0a-4b55-be27-a78010d19f6a` | 6 |
| 7 | `2026-07-30 22:51:01.967+00` | `questionnaire_answer` | `c7891265-ce18-421b-b6a1-22f7a3ff114c` | 9 |
| 8 | `2026-07-30 22:51:12.626+00` | `questionnaire_answer` | `e9439f86-78aa-4aa9-81cd-3b1c42950d49` | 13 |
| 9 | `2026-07-30 23:21:05.903+00` | `questionnaire_answer` | `912081f6-af6c-4855-ac1f-a053f9ef645d` | 14 |

Versions are created when an answer changes the active evidence fingerprint set. No new version is created when the hash and `calculation_version` are unchanged. The completed session recompute did not create version 10 because it ran after version 9 with the same evidence set.

## 10. Runtime Dimension Registry

The runtime source of truth is `DIMENSIONS` in `src/profile/catalog.ts:25-47`; `prisma/seed.ts:7-13` seeds it. There are 43 active rows in `dimension_definitions`.

All rows use `schema_version = reader-profile/1.1.1` and are active. `DimensionDefinition` has `is_active`, not a `status` column. The `core` designation exists only in the separate `ONBOARDING_CORE_DIMENSIONS` set.

```text
narrative_pacing: hook_need, pace_preference, event_density_preference, slow_burn_tolerance, payoff_requirement
structure_clarity: linearity_preference, multi_pov_tolerance, temporal_fragmentation_tolerance, ambiguity_tolerance, open_ending_tolerance, conflict_clarity_need
characters_relationships: character_depth_need, character_likability_need, moral_ambiguity_tolerance, relationship_focus_preference, distinct_voice_need, character_agency_preference
style_voice: style_clarity_preference, ornate_prose_tolerance, introspection_tolerance, repetition_tolerance, experimentation_tolerance, descriptive_density_preference, dialogue_preference
emotional_experience: tension_preference, comfort_preference, humor_preference, darkness_tolerance, emotional_intensity_preference, sadness_tolerance, strangeness_preference, hope_preference
cognitive_demand: linguistic_complexity_tolerance, structural_complexity_tolerance, conceptual_density_tolerance, cast_size_tolerance, worldbuilding_load_tolerance, sustained_attention_tolerance, conceptual_depth_appreciation
discovery: discovery_appetite, genre_exploration_openness, author_novelty_openness, long_tail_openness
```

`conceptual_depth_appreciation` is defined in `src/profile/catalog.ts:42` as:

```text
domain_key        = cognitive_demand
dimension_kind    = target
book_feature_key  = conceptual_depth
matching_operator = absolute_distance
onboarding_core   = true
is_active         = true
schema_version    = reader-profile/1.1.1
```

The current runtime count is 43. `reader_profile_spec.md:2211` says "38 dimensions + conceptual_depth_appreciation (39 total)", so the specification and runtime catalog do not agree.

## 11. Relevant Code Paths

| Responsibility | Path | Function or constant |
|---|---|---|
| Question mappings | `src/profile/catalog.ts` | `QUESTIONS` |
| Evidence creation | `src/profile/evidence.factory.ts` | `EvidenceFactory.createMany()` |
| Answer normalization and mappings | `src/questionnaire/questionnaire.service.ts` | `submitAnswer()`, `resolveMappings()` |
| Value and confidence | `src/profile/profile-calculation.ts` | `aggregateDimension()` |
| Coverage, maturity, readiness, versions | `src/profile/profile.service.ts` | `ProfileService.recompute()` |
| Required-question check | `src/profile/profile.service.ts` | `hasCompletedRequiredQuestions()` |
| Dimension registry | `src/profile/catalog.ts` | `DIMENSIONS`, `ONBOARDING_CORE_DIMENSIONS` |

## 12. Reproducibility Test

No test file was added while producing this diagnostic. The following integration test verifies the exact persisted calculation without changing it:

```ts
import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const sessionId = '0615ceb5-2cb9-4d03-bc84-53320cdf3d37';
const profileId = '15c69d42-f44d-49bf-aa36-c0512bf4d288';

describe('onboarding session reproducibility', () => {
  it('matches the persisted profile calculation', async () => {
    const answers = await prisma.questionAnswer.findMany({
      where: { sessionId },
      orderBy: { answeredAt: 'asc' },
    });
    const profile = await prisma.readerProfile.findUniqueOrThrow({
      where: { id: profileId },
      include: {
        dimensions: { where: { value: { not: null } }, orderBy: { dimensionKey: 'asc' } },
      },
    });

    expect(answers).toHaveLength(15);
    expect(profile.currentVersion).toBe(9);
    expect(profile.readyToRecommend).toBe(false);
    expect(profile.onboardingCoreCoverage.toFixed(4)).toBe('0.5833');
    expect(profile.evidenceMaturity.toFixed(4)).toBe('0.2542');
    expect(profile.dimensions.map((dimension) => [
      dimension.dimensionKey,
      dimension.value?.toFixed(4),
      dimension.confidence.toFixed(4),
      dimension.totalEvidenceWeight.toFixed(4),
    ])).toEqual([
      ['character_agency_preference', '0.8500', '0.1813', '0.6000'],
      ['character_depth_need', '0.9000', '0.1813', '0.6000'],
      ['conceptual_depth_appreciation', '0.6500', '0.1813', '0.6000'],
      ['descriptive_density_preference', '0.8500', '0.2835', '1.0000'],
      ['discovery_appetite', '0.2500', '0.1813', '0.6000'],
      ['hook_need', '0.7500', '0.1813', '0.6000'],
      ['introspection_tolerance', '0.7000', '0.1813', '0.6000'],
      ['linguistic_complexity_tolerance', '0.2500', '0.1813', '0.6000'],
      ['moral_ambiguity_tolerance', '0.8500', '0.1813', '0.6000'],
      ['open_ending_tolerance', '0.4000', '0.1813', '0.6000'],
      ['slow_burn_tolerance', '0.2500', '0.1813', '0.6000'],
      ['strangeness_preference', '0.6000', '0.1813', '0.6000'],
      ['structural_complexity_tolerance', '0.5000', '0.1813', '0.6000'],
      ['tension_preference', '0.8500', '0.1813', '0.6000'],
    ]);
  });
});
```
