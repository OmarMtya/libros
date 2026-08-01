import { DimensionKind, MatchingOperator, ResponseType, TagType } from '@prisma/client';

export const PROFILE_SCHEMA_VERSION = 'reader-profile/1.1.1';
export const QUESTIONNAIRE_VERSION = 'onboarding/1.1';
export const LEGACY_QUESTIONNAIRE_VERSION = 'onboarding/1.0';
export const CALCULATION_VERSION = 'prof-calc/1.1';
export const TAG_TAXONOMY_VERSION = 'tag-tax/1.0.1';

type DimensionSeed = {
  key: string;
  domainKey: string;
  dimensionKind: DimensionKind;
  bookFeatureKey: string | null;
  matchingOperator: MatchingOperator;
};

const domain = (domainKey: string, values: Array<[string, DimensionKind, string, MatchingOperator]>): DimensionSeed[] =>
  values.map(([key, dimensionKind, bookFeatureKey, matchingOperator]) => ({
    key,
    domainKey,
    dimensionKind,
    bookFeatureKey,
    matchingOperator,
  }));

export const DIMENSIONS: DimensionSeed[] = [
  ...domain('narrative_pacing', [
    ['hook_need', 'minimum_required', 'hook_speed', 'minimum_threshold'], ['pace_preference', 'target', 'narrative_pace', 'absolute_distance'], ['event_density_preference', 'target', 'event_density', 'absolute_distance'], ['slow_burn_tolerance', 'maximum_tolerated', 'slow_burn_level', 'maximum_threshold'], ['payoff_requirement', 'minimum_required', 'narrative_payoff', 'minimum_threshold'],
  ]),
  ...domain('structure_clarity', [
    ['linearity_preference', 'target', 'linearity', 'absolute_distance'], ['multi_pov_tolerance', 'maximum_tolerated', 'multi_pov_load', 'maximum_threshold'], ['temporal_fragmentation_tolerance', 'maximum_tolerated', 'temporal_fragmentation', 'maximum_threshold'], ['ambiguity_tolerance', 'maximum_tolerated', 'ambiguity', 'maximum_threshold'], ['open_ending_tolerance', 'maximum_tolerated', 'ending_openness', 'maximum_threshold'], ['conflict_clarity_need', 'minimum_required', 'conflict_clarity', 'minimum_threshold'],
  ]),
  ...domain('characters_relationships', [
    ['character_depth_need', 'minimum_required', 'character_depth', 'minimum_threshold'], ['character_likability_need', 'minimum_required', 'character_likability', 'minimum_threshold'], ['moral_ambiguity_tolerance', 'maximum_tolerated', 'moral_ambiguity', 'maximum_threshold'], ['relationship_focus_preference', 'target', 'relationship_focus', 'absolute_distance'], ['distinct_voice_need', 'minimum_required', 'voice_distinctiveness', 'minimum_threshold'], ['character_agency_preference', 'target', 'character_agency', 'absolute_distance'],
  ]),
  ...domain('style_voice', [
    ['style_clarity_preference', 'target', 'style_clarity', 'absolute_distance'], ['ornate_prose_tolerance', 'maximum_tolerated', 'ornate_prose', 'maximum_threshold'], ['introspection_tolerance', 'maximum_tolerated', 'introspection_density', 'maximum_threshold'], ['repetition_tolerance', 'maximum_tolerated', 'repetition_level', 'maximum_threshold'], ['experimentation_tolerance', 'maximum_tolerated', 'experimentation_level', 'maximum_threshold'], ['descriptive_density_preference', 'target', 'descriptive_density', 'absolute_distance'], ['dialogue_preference', 'target', 'dialogue_ratio', 'absolute_distance'],
  ]),
  ...domain('emotional_experience', [
    ['tension_preference', 'target', 'tension_level', 'absolute_distance'], ['comfort_preference', 'target', 'comfort_level', 'absolute_distance'], ['humor_preference', 'target', 'humor_level', 'absolute_distance'], ['darkness_tolerance', 'maximum_tolerated', 'darkness_level', 'maximum_threshold'], ['emotional_intensity_preference', 'target', 'emotional_intensity', 'absolute_distance'], ['sadness_tolerance', 'maximum_tolerated', 'sadness_level', 'maximum_threshold'], ['strangeness_preference', 'target', 'strangeness_level', 'absolute_distance'], ['hope_preference', 'target', 'hope_level', 'absolute_distance'],
  ]),
  ...domain('cognitive_demand', [
    ['linguistic_complexity_tolerance', 'maximum_tolerated', 'linguistic_complexity', 'maximum_threshold'], ['structural_complexity_tolerance', 'maximum_tolerated', 'structural_complexity', 'maximum_threshold'], ['conceptual_density_tolerance', 'maximum_tolerated', 'conceptual_density', 'maximum_threshold'], ['cast_size_tolerance', 'maximum_tolerated', 'cast_size_load', 'maximum_threshold'], ['worldbuilding_load_tolerance', 'maximum_tolerated', 'worldbuilding_load', 'maximum_threshold'], ['sustained_attention_tolerance', 'maximum_tolerated', 'attention_demand', 'maximum_threshold'], ['conceptual_depth_appreciation', 'target', 'conceptual_depth', 'absolute_distance'],
  ]),
  ...domain('discovery', [
    ['discovery_appetite', 'selection_control', 'discovery_profile', 'selection_control'], ['genre_exploration_openness', 'selection_control', 'discovery_profile', 'selection_control'], ['author_novelty_openness', 'selection_control', 'author_novelty_indicator', 'selection_control'], ['long_tail_openness', 'selection_control', 'popularity_score', 'selection_control'],
  ]),
];

export const ONBOARDING_CORE_DIMENSIONS = new Set([
  'hook_need', 'pace_preference', 'open_ending_tolerance', 'character_depth_need',
  'moral_ambiguity_tolerance', 'distinct_voice_need', 'style_clarity_preference',
  'ornate_prose_tolerance', 'tension_preference', 'comfort_preference',
  'linguistic_complexity_tolerance', 'conceptual_depth_appreciation',
]);

type EvidenceMapping = {
  dimensionKey?: string;
  observedValue?: number;
  observedValueFrom?: 'scale';
  reasonCode: string;
  baseWeight: number;
  tagKey?: string;
  tagType?: TagType;
  affinity?: number;
  specificityFactor?: number;
  positiveTrigger?: string;
};

export type QuestionSeed = {
  key: string;
  text: string;
  type: ResponseType;
  required: boolean;
  order: number;
  validation?: Record<string, unknown>;
  branch?: Record<string, unknown>;
  options?: Array<{ key: string; label: string; mappings?: EvidenceMapping[] }>;
};

const scale = (dimensionKey: string, reasonCode: string): EvidenceMapping[] => [{ dimensionKey, observedValueFrom: 'scale', reasonCode, baseWeight: 0.6 }];

export const QUESTIONS: QuestionSeed[] = [
  { key: 'Q01_LOVED_BOOKS', text: 'Agrega de 3 a 20 libros que hayas disfrutado mucho e indica qué aspecto te gustó de cada uno.', type: 'book_search', required: false, order: 1, validation: { minItems: 3, maxItems: 20, likedAspectsRequired: true } },
  { key: 'Q02_DISLIKED_BOOK', text: 'Agrega de 3 a 20 libros que no te hayan gustado o que hayas abandonado e indica el motivo de cada uno.', type: 'book_search', required: false, order: 2, validation: { minItems: 3, maxItems: 20, reasonCodesRequired: true } },
  { key: 'Q03_PRIORITY_RANKING', text: 'Ordena las tres cosas que más valoras al leer.', type: 'ranking', required: true, order: 3, validation: { allowed: ['plot', 'characters', 'ideas', 'atmosphere', 'style', 'emotion'], maxItems: 3 }, options: [{ key: 'plot', label: 'Trama' }, { key: 'characters', label: 'Personajes' }, { key: 'ideas', label: 'Ideas' }, { key: 'atmosphere', label: 'Atmósfera' }, { key: 'style', label: 'Estilo' }, { key: 'emotion', label: 'Emoción' }] },
  { key: 'Q04_HOOK_NEED', text: '¿Qué tan pronto necesitas sentir que algo importante está pasando?', type: 'scale', required: true, order: 4, options: [{ key: 'scale', label: 'Escala 1 a 5', mappings: scale('hook_need', 'q04_hook_need') }] },
  { key: 'Q05_SLOW_BURN_TOLERANCE', text: 'Puedo disfrutar una historia lenta aunque tarde en mostrar hacia dónde va.', type: 'scale', required: false, order: 5, branch: { show: 'Q05A_SLOW_BURN_CONDITIONS', minimumScale: 2 }, options: [{ key: 'scale', label: 'Escala 1 a 5', mappings: scale('slow_burn_tolerance', 'q05_slow_burn') }] },
  { key: 'Q05A_SLOW_BURN_CONDITIONS', text: '¿Qué tendría que ofrecerte para que esa lentitud valga la pena?', type: 'multi_select', required: false, order: 6, validation: { maxItems: 3 }, branch: { dependsOn: 'Q05_SLOW_BURN_TOLERANCE', minimumNormalized: 0.25 }, options: [{ key: 'strong_characters', label: 'Personajes fuertes' }, { key: 'tension', label: 'Tensión' }, { key: 'atmosphere', label: 'Atmósfera' }, { key: 'beautiful_style', label: 'Estilo bello' }, { key: 'interesting_ideas', label: 'Ideas interesantes' }, { key: 'clear_progress', label: 'Progreso claro' }] },
  { key: 'Q06_STYLE_FRAGMENT', text: '¿Cuál de estas formas de escribir te invitaría más a continuar?', type: 'single_select', required: false, order: 7, options: [
    { key: 'direct', label: 'Directo', mappings: [{ dimensionKey: 'style_clarity_preference', observedValue: 0.9, reasonCode: 'q06_direct_clarity_v1_1', baseWeight: 1, specificityFactor: 1 }, { dimensionKey: 'ornate_prose_tolerance', observedValue: 0.2, reasonCode: 'q06_direct_ornate_v1_1', baseWeight: 1, specificityFactor: 0.7 }, { dimensionKey: 'introspection_tolerance', observedValue: 0.3, reasonCode: 'q06_direct_introspection_v1_1', baseWeight: 1, specificityFactor: 0.6 }, { dimensionKey: 'descriptive_density_preference', observedValue: 0.25, reasonCode: 'q06_direct_description_v1_1', baseWeight: 1, specificityFactor: 0.6 }] },
    { key: 'atmospheric', label: 'Atmosférico', mappings: [{ dimensionKey: 'descriptive_density_preference', observedValue: 0.85, reasonCode: 'q06_atmosphere_description_v1_1', baseWeight: 1, specificityFactor: 1 }, { dimensionKey: 'ornate_prose_tolerance', observedValue: 0.65, reasonCode: 'q06_atmosphere_ornate_v1_1', baseWeight: 1, specificityFactor: 0.7 }, { dimensionKey: 'style_clarity_preference', observedValue: 0.6, reasonCode: 'q06_atmosphere_clarity_v1_1', baseWeight: 1, specificityFactor: 0.6 }, { dimensionKey: 'introspection_tolerance', observedValue: 0.5, reasonCode: 'q06_atmosphere_introspection_v1_1', baseWeight: 1, specificityFactor: 0.5 }] },
    { key: 'introspective', label: 'Introspectivo', mappings: [{ dimensionKey: 'introspection_tolerance', observedValue: 0.9, reasonCode: 'q06_introspective_introspection_v1_1', baseWeight: 1, specificityFactor: 1 }, { dimensionKey: 'conceptual_depth_appreciation', observedValue: 0.75, reasonCode: 'q06_introspective_conceptual_v1_1', baseWeight: 1, specificityFactor: 0.7 }, { dimensionKey: 'style_clarity_preference', observedValue: 0.45, reasonCode: 'q06_introspective_clarity_v1_1', baseWeight: 1, specificityFactor: 0.5 }, { dimensionKey: 'ornate_prose_tolerance', observedValue: 0.6, reasonCode: 'q06_introspective_ornate_v1_1', baseWeight: 1, specificityFactor: 0.5 }] },
  ] },
  { key: 'Q07_COMPLEXITY', text: 'Indica tu tolerancia a un lenguaje y a unas estructuras exigentes.', type: 'structured', required: false, order: 8 },
  { key: 'Q08_ENDING_PREFERENCE', text: '¿Cómo prefieres que cierre una historia?', type: 'single_select', required: true, order: 9, options: [
    { key: 'closed_explained', label: 'Cerrado y explicado', mappings: [{ dimensionKey: 'open_ending_tolerance', observedValue: 0.1, reasonCode: 'q08_closed', baseWeight: 0.6 }] },
    { key: 'resolved_with_interpretation', label: 'Resuelto con interpretación', mappings: [{ dimensionKey: 'open_ending_tolerance', observedValue: 0.4, reasonCode: 'q08_resolved', baseWeight: 0.6 }] },
    { key: 'open_ambiguous', label: 'Abierto y ambiguo', mappings: [{ dimensionKey: 'open_ending_tolerance', observedValue: 0.85, reasonCode: 'q08_open', baseWeight: 0.6 }] },
    { key: 'no_preference', label: 'Sin preferencia' },
  ] },
  { key: 'Q09_CHARACTER_PREFERENCES', text: '¿Qué clase de personajes disfrutas más?', type: 'multi_select', required: false, order: 10, validation: { maxItems: 3 }, options: [
    { key: 'competent', label: 'Competentes', mappings: [{ dimensionKey: 'character_agency_preference', observedValue: 0.85, reasonCode: 'q09_character_competent', baseWeight: 0.6 }] },
    { key: 'psychologically_deep', label: 'Profundos', mappings: [{ dimensionKey: 'character_depth_need', observedValue: 0.9, reasonCode: 'q09_character_psychologically_deep', baseWeight: 0.6 }] },
    { key: 'morally_ambiguous', label: 'Moralmente ambiguos', mappings: [{ dimensionKey: 'moral_ambiguity_tolerance', observedValue: 0.85, reasonCode: 'q09_character_morally_ambiguous', baseWeight: 0.6 }] },
    { key: 'easy_to_like', label: 'Fáciles de querer', mappings: [{ dimensionKey: 'character_likability_need', observedValue: 0.85, reasonCode: 'q09_character_easy_to_like', baseWeight: 0.6 }] },
  ] },
  { key: 'Q10_EMOTIONAL_EXPERIENCE', text: '¿Qué te gustaría sentir con mayor frecuencia al leer?', type: 'multi_select', required: true, order: 11, validation: { maxItems: 3 }, options: [
    { key: 'tension', label: 'Tensión', mappings: [{ dimensionKey: 'tension_preference', observedValue: 0.85, reasonCode: 'q10_emotion_tension_v1_1', baseWeight: 0.6, specificityFactor: 1 }] },
    { key: 'curiosity', label: 'Curiosidad', mappings: [{ positiveTrigger: 'curiosity_drive', reasonCode: 'q10_emotion_curiosity_drive_v1_1', baseWeight: 0.6, specificityFactor: 1 }] },
    { key: 'fun', label: 'Diversión', mappings: [{ dimensionKey: 'humor_preference', observedValue: 0.85, reasonCode: 'q10_emotion_fun_v1_1', baseWeight: 0.6, specificityFactor: 1 }] },
    { key: 'comfort', label: 'Confort', mappings: [{ dimensionKey: 'comfort_preference', observedValue: 0.85, reasonCode: 'q10_emotion_comfort_v1_1', baseWeight: 0.6, specificityFactor: 1 }] },
    { key: 'sadness', label: 'Tristeza', mappings: [{ dimensionKey: 'sadness_tolerance', observedValue: 0.75, reasonCode: 'q10_emotion_sadness_v1_1', baseWeight: 0.6, specificityFactor: 0.8 }, { dimensionKey: 'emotional_intensity_preference', observedValue: 0.7, reasonCode: 'q10_emotion_sadness_intensity_v1_1', baseWeight: 0.6, specificityFactor: 0.6 }] },
    { key: 'wonder', label: 'Asombro', mappings: [{ dimensionKey: 'strangeness_preference', observedValue: 0.75, reasonCode: 'q10_emotion_wonder_v1_1', baseWeight: 0.6, specificityFactor: 0.7 }, { dimensionKey: 'worldbuilding_load_tolerance', observedValue: 0.65, reasonCode: 'q10_emotion_wonder_world_v1_1', baseWeight: 0.6, specificityFactor: 0.5 }] },
    { key: 'discomfort', label: 'Incomodidad', mappings: [{ dimensionKey: 'darkness_tolerance', observedValue: 0.75, reasonCode: 'q10_emotion_discomfort_v1_1', baseWeight: 0.6, specificityFactor: 0.7 }, { dimensionKey: 'emotional_intensity_preference', observedValue: 0.75, reasonCode: 'q10_emotion_discomfort_intensity_v1_1', baseWeight: 0.6, specificityFactor: 0.7 }] },
    { key: 'hope', label: 'Esperanza', mappings: [{ dimensionKey: 'hope_preference', observedValue: 0.85, reasonCode: 'q10_emotion_hope_v1_1', baseWeight: 0.6, specificityFactor: 1 }] },
    { key: 'reflection', label: 'Reflexión', mappings: [{ dimensionKey: 'conceptual_depth_appreciation', observedValue: 0.75, reasonCode: 'q10_emotion_reflection_v1_1', baseWeight: 0.6, specificityFactor: 1 }] },
  ] },
  { key: 'Q11_GENRES_THEMES', text: 'Elige géneros, temas o ambientaciones.', type: 'structured', required: true, order: 12 },
  { key: 'Q12_LENGTH_SERIES', text: '¿Cuántas páginas prefieres y qué prefieres leer: libros autoconclusivos o sagas?', type: 'structured', required: true, order: 13 },
  { key: 'Q13_FORMAT_LANGUAGE', text: '¿En qué idiomas y formatos quieres recibir recomendaciones?', type: 'structured', required: true, order: 14 },
  { key: 'Q14_DISCOVERY_APPETITE', text: '¿Qué tanto quieres alejarnos de lo que ya sabes que te gusta?', type: 'scale', required: true, order: 15, options: [{ key: 'scale', label: 'Escala 1 a 5', mappings: scale('discovery_appetite', 'q14_discovery_appetite') }] },
  { key: 'Q15_ADDITIONAL_COMMENTS', text: '¿Hay algo más que debamos considerar al elegir tu libro?', type: 'structured', required: false, order: 16, validation: { maxLength: 2000 } },
];

export type FeedbackMapping = { dimensionKey: string; observedValue: number; reasonCode: string; baseWeight: number; direction: number };
export const FEEDBACK_MAPPINGS: Record<'positive' | 'negative', Record<string, FeedbackMapping[]>> = {
  positive: {
    story_progress: [{ dimensionKey: 'payoff_requirement', observedValue: 0.8, reasonCode: 'f05_story_progress_pos', baseWeight: 1.4, direction: 1 }],
    tension_curiosity: [{ dimensionKey: 'tension_preference', observedValue: 0.85, reasonCode: 'f05_tension_pos', baseWeight: 1.4, direction: 1 }],
    characters: [{ dimensionKey: 'character_depth_need', observedValue: 0.85, reasonCode: 'f05_characters_pos', baseWeight: 1.4, direction: 1 }, { dimensionKey: 'character_agency_preference', observedValue: 0.75, reasonCode: 'f05_agency_pos', baseWeight: 1.4, direction: 1 }],
    character_relationships: [{ dimensionKey: 'relationship_focus_preference', observedValue: 0.85, reasonCode: 'f05_relationships_pos', baseWeight: 1.4, direction: 1 }],
    writing_style: [{ dimensionKey: 'style_clarity_preference', observedValue: 0.85, reasonCode: 'f05_style_clarity_pos', baseWeight: 1.4, direction: 1 }],
    atmosphere: [{ dimensionKey: 'descriptive_density_preference', observedValue: 0.8, reasonCode: 'f05_atmosphere_pos', baseWeight: 1.4, direction: 1 }],
    ideas_reflection: [{ dimensionKey: 'conceptual_depth_appreciation', observedValue: 0.85, reasonCode: 'f05_ideas_pos', baseWeight: 1.4, direction: 1 }, { dimensionKey: 'introspection_tolerance', observedValue: 0.75, reasonCode: 'f05_reflection_pos', baseWeight: 1.4, direction: 1 }],
    emotional_effect: [{ dimensionKey: 'emotional_intensity_preference', observedValue: 0.85, reasonCode: 'f05_emotional_effect_pos', baseWeight: 1.4, direction: 1 }],
    setting_world: [{ dimensionKey: 'worldbuilding_load_tolerance', observedValue: 0.8, reasonCode: 'f05_setting_pos', baseWeight: 1.4, direction: 1 }],
  },
  negative: {
    slow_without_payoff: [{ dimensionKey: 'slow_burn_tolerance', observedValue: 0.2, reasonCode: 'f06_slow_no_payoff', baseWeight: 1.5, direction: -1 }, { dimensionKey: 'payoff_requirement', observedValue: 0.85, reasonCode: 'f06_payoff_required', baseWeight: 1.5, direction: -1 }],
    too_fast_superficial: [{ dimensionKey: 'event_density_preference', observedValue: 0.6, reasonCode: 'f06_too_fast_superficial_neg', baseWeight: 1.5, direction: -1 }, { dimensionKey: 'character_depth_need', observedValue: 0.85, reasonCode: 'f06_too_fast_superficial_depth', baseWeight: 1.5, direction: -1 }],
    confusing: [{ dimensionKey: 'linguistic_complexity_tolerance', observedValue: 0.25, reasonCode: 'f06_confusing', baseWeight: 1.5, direction: -1 }, { dimensionKey: 'structural_complexity_tolerance', observedValue: 0.25, reasonCode: 'f06_confusing_structural', baseWeight: 1.5, direction: -1 }],
    too_many_voices_names_jumps: [{ dimensionKey: 'multi_pov_tolerance', observedValue: 0.2, reasonCode: 'f06_too_many_pov', baseWeight: 1.5, direction: -1 }, { dimensionKey: 'cast_size_tolerance', observedValue: 0.2, reasonCode: 'f06_cast_size', baseWeight: 1.5, direction: -1 }],
    characters_no_connection: [{ dimensionKey: 'character_likability_need', observedValue: 0.85, reasonCode: 'f06_no_connection', baseWeight: 1.5, direction: -1 }, { dimensionKey: 'relationship_focus_preference', observedValue: 0.85, reasonCode: 'f06_no_relationships', baseWeight: 1.5, direction: -1 }],
    characters_too_similar: [{ dimensionKey: 'distinct_voice_need', observedValue: 0.85, reasonCode: 'f06_too_similar_voices', baseWeight: 1.5, direction: -1 }],
    style_too_simple: [{ dimensionKey: 'style_clarity_preference', observedValue: 0.25, reasonCode: 'f06_style_too_simple', baseWeight: 1.5, direction: -1 }, { dimensionKey: 'ornate_prose_tolerance', observedValue: 0.75, reasonCode: 'f06_needs_ornate', baseWeight: 1.5, direction: -1 }],
    style_too_ornate: [{ dimensionKey: 'style_clarity_preference', observedValue: 0.85, reasonCode: 'f06_style_too_ornate', baseWeight: 1.5, direction: -1 }, { dimensionKey: 'ornate_prose_tolerance', observedValue: 0.25, reasonCode: 'f06_too_ornate_neg', baseWeight: 1.5, direction: -1 }],
    too_much_introspection: [{ dimensionKey: 'introspection_tolerance', observedValue: 0.2, reasonCode: 'f06_too_much_introspection', baseWeight: 1.5, direction: -1 }],
    repetitive: [{ dimensionKey: 'repetition_tolerance', observedValue: 0.2, reasonCode: 'f06_repetitive', baseWeight: 1.5, direction: -1 }],
    too_demanding: [{ dimensionKey: 'linguistic_complexity_tolerance', observedValue: 0.2, reasonCode: 'f06_too_demanding_ling', baseWeight: 1.5, direction: -1 }, { dimensionKey: 'structural_complexity_tolerance', observedValue: 0.2, reasonCode: 'f06_too_demanding_struct', baseWeight: 1.5, direction: -1 }, { dimensionKey: 'conceptual_density_tolerance', observedValue: 0.2, reasonCode: 'f06_too_demanding_conceptual', baseWeight: 1.5, direction: -1 }],
    ending_unsatisfying: [{ dimensionKey: 'open_ending_tolerance', observedValue: 0.1, reasonCode: 'f06_ending_unsatisfying', baseWeight: 1.5, direction: -1 }],
    nothing_important: [{ dimensionKey: 'payoff_requirement', observedValue: 0.85, reasonCode: 'f06_nothing_important', baseWeight: 1.5, direction: -1 }],
  },
};

export const EXPOSURE_FACTORS: Record<number, number> = { 0: 0.1, 5: 0.25, 18: 0.45, 38: 0.7, 63: 0.85, 88: 0.95, 100: 1 };
export const ATTRIBUTION_FACTORS: Record<string, number> = { mostly_book: 1, mixed: 0.6, mostly_timing: 0.25, external_circumstance: 0.1, no_problem: 1 };

export type TagSeed = {
  key: string;
  tagType: TagType;
  parentTagKey?: string | null;
};

const tagKeys = (tagType: TagType, keys: string[]): TagSeed[] => keys.map((key) => ({ key, tagType }));

export const TAG_PARENTS: Record<string, string> = {
  cozy_mystery: 'mystery',
  procedural: 'mystery',
  noir: 'mystery',
  hardboiled: 'mystery',
  psychological_thriller: 'thriller',
  spy_thriller: 'thriller',
  techno_thriller: 'thriller',
  legal_thriller: 'thriller',
  cosmic_horror: 'horror',
  psychological_horror: 'horror',
  slasher: 'horror',
  gothic_horror: 'horror',
  space_opera: 'science_fiction',
  hard_scifi: 'science_fiction',
  cyberpunk: 'science_fiction',
  dystopia: 'science_fiction',
  high_fantasy: 'fantasy',
  urban_fantasy: 'fantasy',
  dark_fantasy: 'fantasy',
  magical_realism: 'speculative_fiction',
  alternate_history: 'speculative_fiction',
  slipstream: 'speculative_fiction',
  paranormal_romance: 'romance',
  satire: 'comedy',
};

const subgenreKeys = (pairs: Array<[string, string]>): TagSeed[] =>
  pairs.map(([key, parentTagKey]) => ({ key, tagType: 'subgenre' as TagType, parentTagKey }));

export const TAGS: TagSeed[] = [
  ...tagKeys('genre', ['literary_fiction', 'mystery', 'thriller', 'horror', 'romance', 'erotica', 'science_fiction', 'fantasy', 'historical_fiction', 'adventure', 'comedy', 'speculative_fiction', 'realistic_fiction', 'narrative_nonfiction', 'essay_memoir', 'short_story_collection', 'history', 'biography_memoir', 'journalism', 'science', 'politics_society', 'philosophy', 'economics']),
  ...subgenreKeys([
    ['cozy_mystery', 'mystery'],
    ['procedural', 'mystery'],
    ['noir', 'mystery'],
    ['hardboiled', 'mystery'],
    ['psychological_thriller', 'thriller'],
    ['spy_thriller', 'thriller'],
    ['techno_thriller', 'thriller'],
    ['legal_thriller', 'thriller'],
    ['cosmic_horror', 'horror'],
    ['psychological_horror', 'horror'],
    ['slasher', 'horror'],
    ['gothic_horror', 'horror'],
    ['space_opera', 'science_fiction'],
    ['hard_scifi', 'science_fiction'],
    ['cyberpunk', 'science_fiction'],
    ['dystopia', 'science_fiction'],
    ['high_fantasy', 'fantasy'],
    ['urban_fantasy', 'fantasy'],
    ['dark_fantasy', 'fantasy'],
    ['magical_realism', 'speculative_fiction'],
    ['alternate_history', 'speculative_fiction'],
    ['slipstream', 'speculative_fiction'],
    ['paranormal_romance', 'romance'],
    ['satire', 'comedy'],
  ]),
  ...tagKeys('theme', ['love', 'identity', 'grief', 'family', 'friendship', 'betrayal', 'redemption', 'justice', 'power', 'freedom', 'war', 'migration', 'memory', 'loneliness', 'ambition', 'faith_doubt', 'technology_society', 'environment', 'mental_health', 'addiction', 'coming_of_age', 'forgiveness', 'mortality', 'moral_dilemma']),
  ...tagKeys('setting', ['urban', 'rural', 'small_town', 'arctic', 'desert', 'island', 'maritime', 'mountain', 'war_zone', 'dystopian_city', 'village', 'metropolis']),
  ...tagKeys('period', ['pre_1900', 'early_20th_century', 'mid_20th_century', 'late_20th_century', 'contemporary', 'near_future', 'distant_future', 'mythic_past']),
  ...tagKeys('cultural_context', ['latin_american', 'hispanic_mexico', 'anglo_united_states', 'anglo_united_kingdom', 'anglo_american', 'european', 'east_asian', 'south_asian', 'southeast_asian', 'middle_eastern', 'african', 'indigenous', 'diaspora']),
  ...tagKeys('narrative_motif', ['quest', 'forbidden_love', 'chosen_one', 'unreliable_narrator', 'locked_room_mystery', 'time_loop', 'parallel_worlds', 'found_family', 'redemption_arc', 'fall_of_hero', 'doppelganger', 'secret_history', 'last_survivor', 'epistolary']),
];
