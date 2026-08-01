export type FeatureUiMetadata = {
  label: string;
  description: string;
  meaningZero: string;
  meaningOne: string;
};

export const FEATURE_UI_CATALOG: Record<string, FeatureUiMetadata> = {
  hook_speed: {
    label: 'Velocidad del gancho',
    description: 'Qué tan pronto aparece el gancho o el evento desencadenante.',
    meaningZero: 'Paciente, tarda en enganchar',
    meaningOne: 'Inmediato, engancha rápido',
  },
  narrative_pace: {
    label: 'Ritmo narrativo',
    description: 'Velocidad general del ritmo narrativo.',
    meaningZero: 'Muy lento',
    meaningOne: 'Muy rápido',
  },
  event_density: {
    label: 'Densidad de eventos',
    description: 'Frecuencia de eventos por unidad narrativa.',
    meaningZero: 'Eventos escasos',
    meaningOne: 'Eventos densos y continuos',
  },
  slow_burn_level: {
    label: 'Slow burn',
    description: 'Nivel de slow burn o de tensión deliberadamente demorada.',
    meaningZero: 'Ninguno',
    meaningOne: 'Extremo',
  },
  narrative_payoff: {
    label: 'Recompensa narrativa',
    description: 'Claridad y fuerza de la recompensa narrativa al final de la obra.',
    meaningZero: 'Contemplativa, sin cierre',
    meaningOne: 'Gran cierre',
  },
  linearity: {
    label: 'Linealidad',
    description: 'Linealidad temporal de la historia.',
    meaningZero: 'Fragmentado, no lineal',
    meaningOne: 'Estrictamente lineal',
  },
  multi_pov_load: {
    label: 'Múltiples puntos de vista',
    description: 'Carga narrativa por múltiples puntos de vista.',
    meaningZero: 'Un solo POV',
    meaningOne: 'Seis o más POV',
  },
  temporal_fragmentation: {
    label: 'Fragmentación temporal',
    description: 'Fragmentación temporal de la trama.',
    meaningZero: 'Línea única',
    meaningOne: 'Radical',
  },
  ambiguity: {
    label: 'Ambigüedad',
    description: 'Nivel de ambigüedad deliberada.',
    meaningZero: 'Todo explícito',
    meaningOne: 'Máxima ambigüedad',
  },
  ending_openness: {
    label: 'Apertura del final',
    description: 'Qué tan abierto queda el final de la obra.',
    meaningZero: 'Cierre explicado',
    meaningOne: 'Final abierto o inconcluso',
  },
  conflict_clarity: {
    label: 'Claridad del conflicto',
    description: 'Claridad del conflicto central.',
    meaningZero: 'Velado',
    meaningOne: 'Manifiesto desde el inicio',
  },
  character_depth: {
    label: 'Profundidad de personajes',
    description: 'Profundidad psicológica de los personajes.',
    meaningZero: 'Personajes planos',
    meaningOne: 'Máxima profundidad',
  },
  character_likability: {
    label: 'Atractivo de personajes',
    description: 'Atractivo y empatía que generan los personajes.',
    meaningZero: 'Hostiles',
    meaningOne: 'Muy empáticos',
  },
  moral_ambiguity: {
    label: 'Ambigüedad moral',
    description: 'Ambigüedad moral de la obra.',
    meaningZero: 'Moral binaria',
    meaningOne: 'Máxima ambigüedad',
  },
  relationship_focus: {
    label: 'Centralidad de relaciones',
    description: 'Centralidad de las relaciones entre personajes.',
    meaningZero: 'Sin relaciones relevantes',
    meaningOne: 'Dominado por relaciones',
  },
  voice_distinctiveness: {
    label: 'Diferenciación de voces',
    description: 'Diferenciación de las voces narrativas.',
    meaningZero: 'Indistinguibles',
    meaningOne: 'Muy diferenciadas',
  },
  character_agency: {
    label: 'Agencia de personajes',
    description: 'Agencia de los personajes sobre el curso de la trama.',
    meaningZero: 'Pasivos',
    meaningOne: 'Deciden todo',
  },
  style_clarity: {
    label: 'Claridad de la prosa',
    description: 'Claridad y transparencia de la prosa.',
    meaningZero: 'Opaca o densa',
    meaningOne: 'Muy clara y directa',
  },
  ornate_prose: {
    label: 'Prosa ornamentada',
    description: 'Ornamentación de la prosa.',
    meaningZero: 'Seca o minimalista',
    meaningOne: 'Barroca',
  },
  introspection_density: {
    label: 'Densidad de introspección',
    description: 'Densidad de pasajes introspectivos.',
    meaningZero: 'Sin introspección',
    meaningOne: 'Dominante',
  },
  repetition_level: {
    label: 'Repetición de motivos',
    description: 'Repetición deliberada de motivos.',
    meaningZero: 'Sin repetición',
    meaningOne: 'Leitmotiv constante',
  },
  experimentation_level: {
    label: 'Experimentación formal',
    description: 'Experimentación formal y narrativa.',
    meaningZero: 'Plenamente convencional',
    meaningOne: 'Altamente experimental',
  },
  descriptive_density: {
    label: 'Densidad descriptiva',
    description: 'Densidad de descripciones.',
    meaningZero: 'Mínima descripción',
    meaningOne: 'Casi pictórica',
  },
  dialogue_ratio: {
    label: 'Proporción de diálogo',
    description: 'Proporción de diálogo frente a narración.',
    meaningZero: 'Casi sin diálogo',
    meaningOne: 'Dominado por diálogo',
  },
  tension_level: {
    label: 'Tensión sostenida',
    description: 'Nivel de tensión sostenida.',
    meaningZero: 'Sin tensión',
    meaningOne: 'Constante',
  },
  comfort_level: {
    label: 'Confort de la lectura',
    description: 'Qué tan reconfortante resulta la lectura.',
    meaningZero: 'Muy incómoda',
    meaningOne: 'Plenamente reconfortante',
  },
  humor_level: {
    label: 'Humor',
    description: 'Presencia de humor.',
    meaningZero: 'Sin humor',
    meaningOne: 'Humor dominante',
  },
  darkness_level: {
    label: 'Tono oscuro',
    description: 'Tono oscuro de la obra.',
    meaningZero: 'Ligero o alegre',
    meaningOne: 'Oscuridad extrema',
  },
  emotional_intensity: {
    label: 'Intensidad emocional',
    description: 'Intensidad emocional de la obra.',
    meaningZero: 'Tenue o serena',
    meaningOne: 'Máxima',
  },
  sadness_level: {
    label: 'Tristeza',
    description: 'Presencia de tristeza.',
    meaningZero: 'Sin tristeza',
    meaningOne: 'Duelo dominante',
  },
  strangeness_level: {
    label: 'Extrañamiento',
    description: 'Nivel de extrañamiento o rareza de la obra.',
    meaningZero: 'Familiar',
    meaningOne: 'Rareza radical',
  },
  hope_level: {
    label: 'Tono esperanzador',
    description: 'Tono esperanzador de la obra.',
    meaningZero: 'Desesperanzado',
    meaningOne: 'Plenamente esperanzador',
  },
  linguistic_complexity: {
    label: 'Exigencia del lenguaje',
    description: 'Exigencia del lenguaje utilizado.',
    meaningZero: 'Lenguaje simple',
    meaningOne: 'Lenguaje muy exigente',
  },
  structural_complexity: {
    label: 'Complejidad estructural',
    description: 'Complejidad de la estructura de la obra.',
    meaningZero: 'Estructura simple',
    meaningOne: 'Muy compleja',
  },
  conceptual_density: {
    label: 'Densidad conceptual',
    description: 'Cuántas ideas abstractas, conceptos, reglas o explicaciones debe procesar el lector y con qué frecuencia aparecen.',
    meaningZero: 'Sin ideas abstractas',
    meaningOne: 'Densidad máxima y constante',
  },
  cast_size_load: {
    label: 'Tamaño del elenco',
    description: 'Tamaño del elenco de personajes.',
    meaningZero: 'Uno o dos personajes',
    meaningOne: 'Más de veinte',
  },
  worldbuilding_load: {
    label: 'Carga de worldbuilding',
    description: 'Carga de construcción del mundo.',
    meaningZero: 'Sin worldbuilding',
    meaningOne: 'Opresivo',
  },
  attention_demand: {
    label: 'Demanda de atención',
    description: 'Demanda de atención sostenida durante la lectura.',
    meaningZero: 'Lectura ligera',
    meaningOne: 'Sostenida máxima',
  },
  conceptual_depth: {
    label: 'Profundidad conceptual',
    description: 'Qué tan profundamente desarrolla la obra sus ideas centrales y cuánto las explora, cuestiona o conecta con sus consecuencias.',
    meaningZero: 'Sin desarrollo más allá de la trama inmediata',
    meaningOne: 'Exploración filosófica profunda que domina la obra',
  },
};

const fallbackLabel = (featureKey: string): string =>
  featureKey
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export function featureUiMetadata(featureKey: string): FeatureUiMetadata {
  return (
    FEATURE_UI_CATALOG[featureKey] ?? {
      label: fallbackLabel(featureKey),
      description: featureKey,
      meaningZero: '0',
      meaningOne: '1',
    }
  );
}
