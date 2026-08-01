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
