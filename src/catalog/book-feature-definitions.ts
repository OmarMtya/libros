export const BOOK_FEATURE_SCHEMA_VERSION = 'book-features/1.0';

export type FeatureScope = 'work' | 'edition';

export type BookFeatureDefinition = {
  featureKey: string;
  scope: FeatureScope;
  valueSemantics: string;
  schemaVersion: string;
  isActive: boolean;
};

const f = (featureKey: string, scope: FeatureScope, valueSemantics: string): BookFeatureDefinition => ({
  featureKey,
  scope,
  valueSemantics,
  schemaVersion: BOOK_FEATURE_SCHEMA_VERSION,
  isActive: true,
});

export const BOOK_FEATURE_DEFINITIONS: BookFeatureDefinition[] = [
  // Dominio 1 — tracción narrativa y ritmo
  f('hook_speed', 'work', 'Que tan pronto ocurre un gancho o evento desencadenante (0 paciente -> 1 inmediato)'),
  f('narrative_pace', 'work', 'Velocidad del ritmo narrativo (0 muy lento -> 1 muy rapido)'),
  f('event_density', 'work', 'Frecuencia de eventos por unidad narrativa (0 escasos -> 1 densos)'),
  f('slow_burn_level', 'work', 'Nivel de slow burn o tension demorada (0 ninguno -> 1 extremo)'),
  f('narrative_payoff', 'work', 'Claridad y fuerza de la recompensa narrativa (0 contemplacion -> 1 gran cierre)'),

  // Dominio 2 — estructura, claridad y cierre
  f('linearity', 'work', 'Linealidad temporal de la historia (0 fragmentado -> 1 estrictamente lineal)'),
  f('multi_pov_load', 'work', 'Carga por multiples puntos de vista (0 un solo POV -> 1 6+ POV)'),
  f('temporal_fragmentation', 'work', 'Fragmentacion temporal de la trama (0 unica linea -> 1 radical)'),
  f('ambiguity', 'work', 'Nivel de ambiguedad deliberada (0 todo explicito -> 1 maxima ambiguedad)'),
  f('ending_openness', 'work', 'Apertura del final (0 cierre explicado -> 1 final abierto/inconcluso)'),
  f('conflict_clarity', 'work', 'Claridad del conflicto central (0 velado -> 1 manifiesto desde el inicio)'),

  // Dominio 3 — personajes y relaciones
  f('character_depth', 'work', 'Profundidad psicologica de los personajes (0 planos -> 1 maxima profundidad)'),
  f('character_likability', 'work', 'Atractivo/empatia de los personajes (0 hostiles -> 1 muy empaticos)'),
  f('moral_ambiguity', 'work', 'Ambiguedad moral (0 moral binaria -> 1 maxima ambiguedad)'),
  f('relationship_focus', 'work', 'Centralidad de las relaciones (0 sin relaciones -> 1 dominado por relaciones)'),
  f('voice_distinctiveness', 'work', 'Diferenciacion de voces (0 indistinguibles -> 1 muy diferenciadas)'),
  f('character_agency', 'work', 'Agencia de los personajes (0 pasivos -> 1 deciden todo)'),

  // Dominio 4 — estilo y voz
  f('style_clarity', 'edition', 'Claridad de la prosa (0 opaco -> 1 muy claro y directo)'),
  f('ornate_prose', 'work', 'Ornamentacion de la prosa (0 seca/minimalista -> 1 barroca)'),
  f('introspection_density', 'work', 'Densidad de introspeccion (0 sin introspeccion -> 1 dominante)'),
  f('repetition_level', 'work', 'Repeticion deliberada de motivos (0 sin repeticion -> 1 leitmotiv)'),
  f('experimentation_level', 'work', 'Experimentacion formal (0 plenamente convencional -> 1 altamente experimental)'),
  f('descriptive_density', 'work', 'Densidad descriptiva (0 minima descripcion -> 1 casi pictorica)'),
  f('dialogue_ratio', 'work', 'Proporcion de dialogo (0 casi sin dialogo -> 1 dominado por dialogo)'),

  // Dominio 5 — experiencia emocional
  f('tension_level', 'work', 'Nivel de tension sostenida (0 sin tension -> 1 constante)'),
  f('comfort_level', 'work', 'Confort de la lectura (0 muy incomodo -> 1 plenamente reconfortante)'),
  f('humor_level', 'work', 'Presencia de humor (0 sin humor -> 1 humor dominante)'),
  f('darkness_level', 'work', 'Tono oscuro (0 ligero/alegre -> 1 oscuridad extrema)'),
  f('emotional_intensity', 'work', 'Intensidad emocional (0 tenue/sereno -> 1 maxima)'),
  f('sadness_level', 'work', 'Presencia de tristeza (0 sin tristeza -> 1 duelo dominante)'),
  f('strangeness_level', 'work', 'Extrañamiento (0 familiar -> 1 extranieza radical)'),
  f('hope_level', 'work', 'Tono esperanzador (0 desesperanzado -> 1 plenamente esperanzador)'),

  // Dominio 6 — exigencia cognitiva
  f('linguistic_complexity', 'edition', 'Exigencia del lenguaje (0 lenguaje simple -> 1 lenguaje muy exigente)'),
  f('structural_complexity', 'work', 'Complejidad estructural (0 estructura simple -> 1 muy compleja)'),
  f('conceptual_density', 'work', 'Cuantas ideas abstractas, conceptos, reglas o explicaciones debe procesar el lector y con que frecuencia aparecen (0 sin ideas abstractas -> 1 densidad conceptual maxima y constante)'),
  f('cast_size_load', 'work', 'Tamano del elenco (0 1-2 personajes -> 1 mas de 20)'),
  f('worldbuilding_load', 'work', 'Carga de worldbuilding (0 sin worldbuilding -> 1 opresivo)'),
  f('attention_demand', 'work', 'Demanda de atencion sostenida (0 lectura ligera -> 1 sostenida maxima)'),
  f('conceptual_depth', 'work', 'Que tan profundamente desarrolla la obra sus ideas centrales y cuanto las explora, cuestiona o conecta con sus consecuencias (0 sin desarrollo mas alla de la trama -> 1 exploracion filosofica profunda que domina la obra)'),
];

const byKey = new Map<string, BookFeatureDefinition>(BOOK_FEATURE_DEFINITIONS.map((definition) => [definition.featureKey, definition]));

export function featureDefinition(featureKey: string): BookFeatureDefinition | undefined {
  return byKey.get(featureKey);
}

export const REQUIRED_FEATURES = [
  'hook_speed',
  'narrative_pace',
  'slow_burn_level',
  'narrative_payoff',
  'style_clarity',
  'ornate_prose',
  'linguistic_complexity',
  'structural_complexity',
  'conceptual_density',
  'character_depth',
  'character_agency',
  'character_likability',
  'relationship_focus',
  'cast_size_load',
  'multi_pov_load',
  'introspection_density',
  'repetition_level',
  'tension_level',
  'descriptive_density',
  'worldbuilding_load',
  'ending_openness',
] as const;

export const REQUIRED_FEATURES_SET = new Set<string>(REQUIRED_FEATURES);
