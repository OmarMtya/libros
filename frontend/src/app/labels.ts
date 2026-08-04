export const TAG_LABELS: Partial<Record<string, string>> = {
  literary_fiction: 'Novela literaria', mystery: 'Misterio', thriller: 'Suspenso', horror: 'Terror', romance: 'Romance', erotica: 'Erótico',
  science_fiction: 'Ciencia ficción', fantasy: 'Fantasía', historical_fiction: 'Ficción histórica', adventure: 'Aventura',
  comedy: 'Comedia', speculative_fiction: 'Ficción especulativa', realistic_fiction: 'Ficción realista',
  narrative_nonfiction: 'No ficción narrativa', essay_memoir: 'Ensayo y memorias', short_story_collection: 'Cuentos',
  history: 'Historia', biography_memoir: 'Biografía y memorias', journalism: 'Periodismo y crónica', science: 'Ciencia',
  politics_society: 'Política y sociedad', philosophy: 'Filosofía', economics: 'Economía',
  cozy_mystery: 'Misterio acogedor', procedural: 'Procedural', noir: 'Noir', hardboiled: 'Hardboiled',
  psychological_thriller: 'Thriller psicológico', spy_thriller: 'Espionaje', techno_thriller: 'Tecno-thriller',
  legal_thriller: 'Judicial', cosmic_horror: 'Horror cósmico', psychological_horror: 'Horror psicológico', slasher: 'Slasher',
  gothic_horror: 'Gótico', space_opera: 'Space opera', hard_scifi: 'Ciencia ficción dura', cyberpunk: 'Cyberpunk',
  dystopia: 'Distopía', high_fantasy: 'Fantasía épica', urban_fantasy: 'Fantasía urbana', dark_fantasy: 'Fantasía oscura',
  magical_realism: 'Realismo mágico', alternate_history: 'Historia alternativa', slipstream: 'Slipstream',
  paranormal_romance: 'Romance paranormal', satire: 'Sátira',
  love: 'Amor', identity: 'Identidad', grief: 'Duelo', family: 'Familia', friendship: 'Amistad', betrayal: 'Traición',
  redemption: 'Redención', justice: 'Justicia', power: 'Poder', freedom: 'Libertad', war: 'Guerra', migration: 'Migración',
  memory: 'Memoria', loneliness: 'Soledad', ambition: 'Ambición', faith_doubt: 'Fe y duda',
  technology_society: 'Tecnología y sociedad', environment: 'Naturaleza y entorno', mental_health: 'Salud mental',
  addiction: 'Adicción', coming_of_age: 'Madurez', forgiveness: 'Perdón', mortality: 'Mortalidad', moral_dilemma: 'Dilema moral',
  urban: 'Urbano', rural: 'Rural', small_town: 'Pueblo pequeño', arctic: 'Ártico y polar', desert: 'Desierto', island: 'Isla',
  maritime: 'Marítimo', mountain: 'Montaña', war_zone: 'Zona de conflicto', dystopian_city: 'Ciudad distópica', village: 'Aldea',
  metropolis: 'Metrópolis',
  pre_1900: 'Anterior a 1900', early_20th_century: 'Primer tercio del siglo XX', mid_20th_century: 'Mediados del siglo XX',
  late_20th_century: 'Finales del siglo XX', contemporary: 'Contemporáneo', near_future: 'Futuro cercano',
  distant_future: 'Futuro lejano', mythic_past: 'Pasado mítico',
  latin_american: 'Latinoamericano', hispanic_mexico: 'México', anglo_united_states: 'Estados Unidos',
  anglo_united_kingdom: 'Reino Unido', european: 'Europeo', east_asian: 'Asiático oriental', south_asian: 'Asia del Sur',
  southeast_asian: 'Sudeste asiático', middle_eastern: 'Medio Oriente', african: 'Africano', indigenous: 'Indígena', diaspora: 'Diáspora',
  quest: 'Búsqueda', forbidden_love: 'Amor prohibido', chosen_one: 'Elegido', unreliable_narrator: 'Narrador no confiable',
  locked_room_mystery: 'Misterio de cuarto cerrado', time_loop: 'Bucle temporal', parallel_worlds: 'Mundos paralelos',
  found_family: 'Familia elegida', redemption_arc: 'Arco de redención', fall_of_hero: 'Caída del héroe',
  doppelganger: 'Dobles', secret_history: 'Historia secreta', last_survivor: 'Último superviviente', epistolary: 'Epistolar',
};

export const TAG_TYPE_LABELS: Partial<Record<string, string>> = {
  genre: 'género', subgenre: 'subgénero', theme: 'tema', setting: 'ambientación', period: 'período',
  cultural_context: 'contexto cultural', narrative_motif: 'motivo narrativo',
};

export const LOVED_BOOK_ASPECTS = [
  { key: 'characters', label: 'Personajes' },
  { key: 'prose', label: 'Prosa' },
  { key: 'originality', label: 'Originalidad' },
  { key: 'ending', label: 'Final' },
  { key: 'emotions', label: 'Emociones' },
  { key: 'universe', label: 'Universo' },
];

export const DISLIKED_BOOK_REASONS = [
  { key: 'too_conceptually_dense', label: 'Demasiado denso conceptualmente' },
  { key: 'too_slow', label: 'Demasiado lento' },
  { key: 'too_confusing', label: 'Confuso' },
  { key: 'too_long', label: 'Demasiado largo' },
  { key: 'not_engaging', label: 'No me enganchó' },
  { key: 'other', label: 'Otro' },
];

export const FEEDBACK_POSITIVE_ASPECTS: Record<string, string> = {
  story_progress: 'El avance de la historia',
  tension_curiosity: 'La tensión o curiosidad',
  characters: 'Los personajes',
  writing_style: 'La forma de escribir',
  ideas_reflection: 'Las ideas o reflexiones',
  atmosphere: 'La atmósfera',
};

export const FEEDBACK_NEGATIVE_ASPECTS: Record<string, string> = {
  slow_without_payoff: 'Fue lento sin una recompensa clara',
  confusing: 'Resultó confuso',
  style_too_ornate: 'El estilo fue demasiado recargado',
  too_much_introspection: 'Tuvo demasiada introspección',
  repetitive: 'Se sintió repetitivo',
  too_demanding: 'Exigía demasiado esfuerzo',
  topic_no_interest: 'No me interesó el tema',
  length_problem: 'El tamaño fue un problema',
};

export const FEEDBACK_NOT_STARTED_REASONS: Record<string, string> = {
  no_time: 'No tuve tiempo',
  wrong_mood: 'No era el momento',
  read_something_else: 'Leí otra cosa',
  format_or_size: 'Formato o tamaño',
  did_not_attract_me: 'No me atrajo',
  other: 'Otro',
};

export const FEEDBACK_OUTCOME_ATTRIBUTIONS: Record<string, string> = {
  mostly_book: 'Principalmente el libro',
  mixed: 'Mezcla',
  mostly_timing: 'Principalmente el momento',
  external_circumstance: 'Circunstancia externa',
  no_problem: 'Nada en particular',
};

export const FEEDBACK_COMPLETION_LABELS: Record<number, string> = {
  5: 'Apenas lo empezó',
  18: 'Leí una parte',
  38: 'Menos de la mitad',
  63: 'Más de la mitad',
  88: 'Casi lo terminó',
  100: 'Lo terminó',
};
