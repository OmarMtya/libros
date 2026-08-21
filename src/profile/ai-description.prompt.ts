const DIMENSION_GLOSSARY: Record<string, string> = {
  hook_need: 'qué tan pronto necesita que la historia le atrape (alto: necesita enganche inmediato; bajo: le da tiempo al libro para arrancar)',
  pace_preference: 'el ritmo general que disfruta (alto: ritmo rápido; bajo: ritmo reposado)',
  event_density_preference: 'cuánto contenido debe pasar en cada página (alto: quiere mucha acción y giros; bajo: tolera capítulos más quietos)',
  slow_burn_tolerance: 'cuánta paciencia tiene con historias lentas que construyen despacio (alto: las disfruta; bajo: se desespera)',
  payoff_requirement: 'cuánta necesidad tiene de que todo cierre y se justifique (alto: exige un final que lo pague todo; bajo: le basta el camino)',
  linearity_preference: 'qué tan directa prefiere la trama (alto: quiere avance lineal claro; bajo: disfruta saltos y ramificaciones)',
  multi_pov_tolerance: 'cuántos puntos de vista y voces distintas le parecen bien (alto: los disfruta; bajo: se pierde con muchas voces)',
  temporal_fragmentation_tolerance: 'cuánto tolera saltos en el tiempo o narración no cronológica (alto: los disfruta; bajo: prefiere el orden)',
  ambiguity_tolerance: 'cuánta ambigüedad e incertidumbre tolera mientras lee (alto: le gusta interpretar; bajo: quiere respuestas claras)',
  open_ending_tolerance: 'cuánto le gustan los finales abiertos o sin cerrar del todo (alto: le gustan; bajo: prefiere finales cerrados y explicados)',
  conflict_clarity_need: 'qué tan claro necesita que sea el conflicto central (alto: quiere saber qué está en juego; bajo: acepta conflictos difusos)',
  character_depth_need: 'cuánta profundidad psicológica necesita en los personajes (alto: quiere personajes complejos; bajo: le basta con personajes funcionales)',
  character_likability_need: 'qué tanto necesita querer a los personajes (alto: prefiere personajes agradables; bajo: tolera personajes difíciles)',
  moral_ambiguity_tolerance: 'cuánto tolera personajes moralmente grises o cuestionables (alto: los disfruta; bajo: prefiere claros en el bien y el mal)',
  relationship_focus_preference: 'cuánto le importan las relaciones entre personajes (alto: le importan mucho; bajo: le importan poco)',
  distinct_voice_need: 'qué tanto necesita que cada personaje suene diferente (alto: lo valora; bajo: no le molesta que se parezcan)',
  character_agency_preference: 'qué tanto le gusta que los personajes tomen decisiones y muevan la historia (alto: lo prefiere; bajo: tolera personajes arrastrados por la trama)',
  style_clarity_preference: 'qué tan claro y directo prefiere el estilo de escritura (alto: directo; bajo: tolera estilos más elaborados)',
  ornate_prose_tolerance: 'cuánta prosa recargada o adornada tolera (alto: la disfruta; bajo: se aburre con demasiada ornamenta)',
  introspection_tolerance: 'cuánta introspección y vida interior de los personajes tolera (alto: la disfruta; bajo: prefiere que pasen cosas)',
  repetition_tolerance: 'cuánta repetición de ideas o imágenes tolera (alto: no le molesta; bajo: le cansa)',
  experimentation_tolerance: 'cuánta experimentación narrativa tolera (alto: la disfruta; bajo: prefiere formatos tradicionales)',
  descriptive_density_preference: 'cuánta descripción y ambientación quiere (alto: le gusta sumergirse en el entorno; bajo: prefiere menos descripción)',
  dialogue_preference: 'cuánto disfruta el diálogo (alto: lo prefiere; bajo: le basta con poca conversación)',
  tension_preference: 'cuánta tensión quiere sentir (alto: busca tensión; bajo: prefiere una lectura más tranquila)',
  comfort_preference: 'qué tanto valora la sensación de confort y calidez al leer (alto: la valora; bajo: no le incomoda la incomodidad)',
  humor_preference: 'cuánto disfruta el humor en la lectura (alto: lo disfruta; bajo: le da igual)',
  darkness_tolerance: 'cuánta oscuridad, violencia o temas duros tolera (alto: los tolera; bajo: los evita)',
  emotional_intensity_preference: 'qué tan intenso le gusta el impacto emocional (alto: busca emociones fuertes; bajo: prefiere emociones suaves)',
  sadness_tolerance: 'cuánta tristeza tolera en las historias (alto: la acepta; bajo: la evita)',
  strangeness_preference: 'cuánto disfruta lo extraño, raro o inusual (alto: le encanta; bajo: prefiere lo familiar)',
  hope_preference: 'cuánto valora que la historia termine con esperanza (alto: lo valora; bajo: no lo exige)',
  linguistic_complexity_tolerance: 'cuánto lenguaje exigente o rebuscado tolera (alto: lo acepta; bajo: prefiere un lenguaje sencillo)',
  structural_complexity_tolerance: 'cuánta complejidad estructural tolera (alto: la acepta; bajo: prefiere estructuras simples)',
  conceptual_density_tolerance: 'cuántas ideas densas y conceptos por página tolera (alto: los acepta; bajo: prefiere ideas más ligeras)',
  cast_size_tolerance: 'cuántos personajes distintos maneja bien (alto: los maneja; bajo: se pierde con muchos)',
  worldbuilding_load_tolerance: 'cuánto mundo construido y detalle de ambientación tolera (alto: le encanta sumergirse; bajo: prefiere mundos ligeros)',
  sustained_attention_tolerance: 'cuánto puede mantener la atención en una lectura exigente (alto: puede; bajo: necesita algo más ligero)',
  conceptual_depth_appreciation: 'cuánto aprecia las ideas y la profundidad intelectual (alto: lo disfruta mucho; bajo: prefiere lecturas más ligeras)',
  discovery_appetite: 'qué tanto quiere salir de lo que ya conoce (alto: busca novedad y sorpresa; bajo: prefiere quedarse en sus zonas conocidas)',
  genre_exploration_openness: 'qué tan abierto está a explorar géneros nuevos (alto: abierto; bajo: se queda en sus géneros de siempre)',
  author_novelty_openness: 'qué tan abierto está a autores que no conoce (alto: abierto; bajo: prefiere autores conocidos)',
  long_tail_openness: 'qué tan abierto está a libros poco populares o fuera del radar (alto: le gustan; bajo: prefiere títulos conocidos)',
};

const PRIORITY_LABELS: Record<string, string> = {
  plot: 'trama',
  characters: 'personajes',
  ideas: 'temas que trata',
  atmosphere: 'ambiente',
  style: 'estilo',
  emotion: 'emoción',
};

const SERIES_LABELS: Record<string, string> = {
  standalone_only: 'solo libros autoconclusivos',
  standalone_preferred: 'prefiere libros autoconclusivos',
  no_preference: 'sin preferencia entre autoconclusivos y sagas',
};

const LANGUAGE_LABELS: Record<string, string> = {
  es: 'español',
  en: 'inglés',
};

export type AiDescriptionProfileInput = {
  displayName?: string | null;
  priorityRanking?: string[];
  dimensions: Array<{ key: string; value: number | null; confidence: number }>;
  tagPreferences: Array<{ tagKey: string; name: string; affinity: number }>;
  constraints?: {
    preferredPagesMin?: number | null;
    preferredPagesMax?: number | null;
    seriesPreference?: string | null;
    acceptedLanguages?: string[];
    acceptedFormats?: string[];
  };
  lovedBooks?: Array<{ title: string; authors: string[] }>;
  dislikedBooks?: Array<{ title: string; authors: string[] }>;
};

const SYSTEM_PROMPT = [
  'Eres un curador editorial que escribe descripciones cálidas y humanas de lectores.',
  'A partir de un resumen técnico del perfil de lectura, escribes UN párrafo breve en español de México que describa cómo es esa persona como lectora.',
  '',
  'Reglas estrictas:',
  '- Escribe como si conocieras a la persona y la describieras con naturalidad: "A {nombre} le gusta…", "Se aburre si…", "Disfruta…", "Su punto fuerte es…".',
  '- Todo debe ser subjetivo y humano. NUNCA uses números, porcentajes, puntuaciones, confidence, ni términos técnicos o taxonómicos.',
  '- NUNCA digas "según su perfil", "basado en su puntuación", "sus métricas" ni nada parecido.',
  '- NUNCA menciones dimensiones, claves, etiquetas internas o el nombre técnico de ninguna medida.',
  '- Si conoces el nombre de la persona, úsalo de forma natural. Si no, escribe de forma impersonal ("A esta persona le gusta…").',
  '- El párrafo debe tener MÁXIMO 400 caracteres.',
  '- Devuelve únicamente el párrafo, sin comillas, sin prefijos como "Descripción:" ni notas adicionales.',
  '',
  'Glosario para interpretar cada medida (cómo se lee cada dato, para que traduzcas a lenguaje humano):',
  Object.entries(DIMENSION_GLOSSARY).map(([key, meaning]) => `- ${key}: ${meaning}`).join('\n'),
  '',
  'Prioridades de lectura que la persona ordenó (de mayor a menor importancia):',
  Object.entries(PRIORITY_LABELS).map(([key, label]) => `- ${key}: ${label}`).join('\n'),
  '',
  'Idiomas aceptados:',
  Object.entries(LANGUAGE_LABELS).map(([key, label]) => `- ${key}: ${label}`).join('\n'),
].join('\n');

function humanConstraints(constraints: AiDescriptionProfileInput['constraints']): string[] {
  if (!constraints) return ['Sin restricciones de extensión o formato registradas.'];
  const lines: string[] = [];
  if (constraints.preferredPagesMin != null && constraints.preferredPagesMax != null) {
    lines.push(`extensión preferida: entre ${constraints.preferredPagesMin} y ${constraints.preferredPagesMax} páginas`);
  }
  if (constraints.seriesPreference) lines.push(`sagas: ${SERIES_LABELS[constraints.seriesPreference] ?? constraints.seriesPreference}`);
  const languages = (constraints.acceptedLanguages ?? []).map((code) => LANGUAGE_LABELS[code] ?? code);
  if (languages.length) lines.push(`idiomas aceptados: ${languages.join(' y ')}`);
  const formats = (constraints.acceptedFormats ?? []).map((format) => (format === 'physical' ? 'libro físico' : format));
  if (formats.length) lines.push(`formatos aceptados: ${formats.join(', ')}`);
  return lines.length ? lines : ['Sin restricciones de extensión o formato registradas.'];
}

export function buildProfileDescriptionPrompt(profile: AiDescriptionProfileInput): { system: string; user: string } {
  const name = profile.displayName?.trim() || null;
  const nameLine = name ? `El nombre de la persona es: ${name}` : 'No se conoce el nombre de la persona.';
  const ranking = profile.priorityRanking?.length
    ? profile.priorityRanking.map((key) => PRIORITY_LABELS[key] ?? key).join(' → ')
    : 'No registró prioridades.';
  const dimensions = profile.dimensions
    .filter((dimension) => dimension.value != null && dimension.confidence >= 0.15)
    .map((dimension) => `- ${dimension.key}: valor ${dimension.value!.toFixed(2)} (0=extremo bajo, 1=extremo alto)`);
  const tags = profile.tagPreferences.length
    ? profile.tagPreferences
      .slice()
      .sort((a, b) => b.affinity - a.affinity)
      .map((tag) => `- ${tag.name}: afinidad ${tag.affinity.toFixed(2)} (positiva = le gusta, negativa = le desagrada)`)
    : ['Sin preferencias de categorías declaradas.'];
  const loved = profile.lovedBooks?.length
    ? profile.lovedBooks.map((book) => `- ${book.title}${book.authors.length ? ` (${book.authors.join(', ')})` : ''}`).join('\n')
    : 'No registró libros favoritos.';
  const disliked = profile.dislikedBooks?.length
    ? profile.dislikedBooks.map((book) => `- ${book.title}${book.authors.length ? ` (${book.authors.join(', ')})` : ''}`).join('\n')
    : 'No registró libros que no le gustaran.';

  const user = [
    nameLine,
    '',
    `Prioridades de lectura (de mayor a menor): ${ranking}`,
    '',
    'Perfil por dimensiones (0=extremo bajo, 1=extremo alto):',
    dimensions.length ? dimensions.join('\n') : 'Sin dimensiones con datos suficientes.',
    '',
    'Preferencias de categorías (afinidad positiva = le gusta; negativa = le desagrada):',
    tags.join('\n'),
    '',
    'Restricciones de extensión y formato:',
    humanConstraints(profile.constraints).map((line) => `- ${line}`).join('\n'),
    '',
    'Libros que ha disfrutado:',
    loved,
    '',
    'Libros que no le han gustado o ha abandonado:',
    disliked,
  ].join('\n');

  return { system: SYSTEM_PROMPT, user };
}
