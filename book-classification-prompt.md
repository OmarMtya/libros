# Prompt reutilizable: clasificación de libros

> **Objetivo:** dado un libro (obra + edición) y este prompt, producir un JSON de clasificación válido
> que pueda guardarse directamente en el editor de clasificaciones del admin.
> Versión de contrato: `book-features/1.0` · `content-types/1.0` · `tag-tax/1.0.1`.

---

## 0. Rol e instrucciones generales

Actúa como curador editorial experto. Antes de asignar cualquier valor:

1. **Investiga múltiples fuentes** (sinopsis editorial, capítulos iniciales o muestra de texto y,
   sobre todo, **varias reseñas** — mínimo 3 cuando existan: lectores en Goodreads/StoryGraph, reseñas
   críticas y la crítica profesional). No bases una feature en una sola reseña.
2. **Cruza la evidencia**: si dos reseñas difieren en una misma feature, busca una tercera fuente.
3. **No uses el valor por defecto `0.5`** para "no saber": si no hay evidencia suficiente, omite la
   feature del array `features` (o deja `value: null`).
4. **Todo valor se justifica mentalmente contra la ancla semántica** de la feature (ver §4): elige el
   valor de la escala que mejor describa el libro, no el que "se sienta bien".
5. Solo puedes proponer **tags que existan** en la taxonomía (§5). No inventes claves.
6. Asigna **al menos 1 genre y 1 theme** obligatorios; los subgéneros van solo si aplican (ver §6).
7. No emitas texto fuera del bloque JSON: la salida debe ser **un único JSON válido**, sin markdown
   alrededor (a menos que la herramienta receptora pida otra cosa).

---

## 1. Formato JSON exacto esperado

Payload para crear/guardar una clasificación (esquema `SaveClassificationDto` / `CreateClassificationDto`):

```json
{
  "contentTypeKey": "fiction",
  "contentTypeSchemaVersion": "content-types/1.0",
  "featureSchemaVersion": "book-features/1.0",
  "tagTaxonomyVersion": "tag-tax/1.0.1",
  "features": [
    {
      "featureKey": "hook_speed",
      "value": 0.75,
      "confidence": 0.65,
      "notes": "El gancho aparece en la primera página (rescate en alta mar); corroborado en 3 reseñas."
    }
  ],
  "tags": [
    { "tagKey": "science_fiction", "strength": 0.9, "confidence": 0.7 },
    { "tagKey": "identity", "strength": 0.6, "confidence": 0.6 }
  ]
}
```

Campos opcionales adicionales en el flujo "crear clasificación" (`CreateClassificationDto`):
- `classifierVersion` (string ≤ 30): si no se envía, el backend usa el valor por defecto.
- Por feature: `source` (string ≤ 100, p. ej. `curator_direct`) y `evidence` (objeto libre, se persiste como JSON).

Reglas de forma:
- `features[]`: sin claves duplicadas; solo `featureKey` que existan en `book-features/1.0` y que **no
  sean `not_applicable`** para el `contentTypeKey` elegido.
- `tags[]`: sin claves duplicadas; solo `tagKey` existentes en `tag-tax/1.0.1` con `status: active`.
- Las features **requeridas** (según `contentTypeKey`, ver §6) deben incluirse **siempre** con
  `value` y `confidence`; las opcionales pueden omitirse. Nunca incluyas una feature `not_applicable`.

---

## 2. Versiones y tipos de contenido

| Concepto | Valor |
|---|---|
| `featureSchemaVersion` | `book-features/1.0` |
| `contentTypeSchemaVersion` | `content-types/1.0` |
| `tagTaxonomyVersion` | `tag-tax/1.0.1` |

`contentTypeKey` permitidos (enum cerrado):

| Clave | Descripción |
|---|---|
| `fiction` | Ficción (novela) |
| `narrative_nonfiction` | No ficción narrativa (crónica, periodismo literario) |
| `expository_nonfiction` | No ficción expositiva (divulgación, historia, ciencia) |
| `memoir` | Memorias / biografía personal |
| `essay` | Ensayo |
| `short_stories` | Cuentos / colección de relatos |
| `poetry` | Poesía |
| `other` | Otro |

---

## 3. Escalas comunes

- **`value` (features):** `0..1`, hasta 4 decimales (`NUMERIC(5,4)`). Ver anclas por feature en §4.
- **`confidence` (features y tags):** `0..0.95`, hasta 4 decimales. Refleja consistencia entre fuentes.
- **`strength` (tags):** `0..1`. `0` = el libro **no** exhibe el tag; `>0` = el tag aplica con esa
  intensidad. Nunca negativa.
- **`notes` (features):** string ≤ 2000 caracteres; evidencia/justificación opcional.

Semántica de `confidence`:
- Si el valor proviene de una **única fuente IA**, `confidence` no debe superar `0.40`
  (cap de contribución de IA del pipeline canónico).
- Si varias fuentes coinciden (reseñas + muestra), puede subir hasta `0.90`; con revisión humana
  alineada hasta `0.95`.
- `confidence < 0.20` equivale a ausencia a efectos de elegibilidad/scoring.

---

## 4. Features disponibles (`book-features/1.0`, 39) y sus anclas

> `scope` `work` = clasifica la obra; `edition` = depende de la edición (solo las de scope `edition`
> varían entre ediciones; las demás se asocian a la obra). Toda feature usa escala 0..1 con los
> extremos indicados.

### Dominio 1 — Tracción narrativa y ritmo

| `featureKey` | scope | 0.00 | 1.00 |
|---|---|---|---|
| `hook_speed` | work | arranque muy paciente, gancho tras cap. 6+ | gancho inmediato en la primera página |
| `narrative_pace` | work | muy lento, casi contemplativo | ritmo muy rápido, sin respiro |
| `event_density` | work | eventos escasos, contemplativo | eventos densos, casi sin pausa |
| `slow_burn_level` | work | sin slow burn, todo explícito | slow burn extremo, tensión demorada |
| `narrative_payoff` | work | contemplación pura, sin recompensa | gran recompensa, cierre contundente |

### Dominio 2 — Estructura, claridad y cierre

| `featureKey` | scope | 0.00 | 1.00 |
|---|---|---|---|
| `linearity` | work | no lineal, fragmentado | estrictamente lineal cronológico |
| `multi_pov_load` | work | 1 punto de vista | 6+ POV o narrador colectivo |
| `temporal_fragmentation` | work | un único timeline lineal | fragmentación temporal radical |
| `ambiguity` | work | todo explícito y claro | máxima ambigüedad, abierto a lecturas |
| `ending_openness` | work | cierre completo y explicado | final totalmente abierto/inconcluso |
| `conflict_clarity` | work | conflicto velado, jamás explicitado | conflicto manifiesto desde el inicio |

### Dominio 3 — Personajes y relaciones

| `featureKey` | scope | 0.00 | 1.00 |
|---|---|---|---|
| `character_depth` | work | personajes planos | profundidad psicológica máxima |
| `character_likability` | work | protagonistas hostiles | muy atractivos/empáticos |
| `moral_ambiguity` | work | moral binaria, clara | máxima ambigüedad, sin anclar |
| `relationship_focus` | work | sin relaciones significativas | libro dominado por relaciones |
| `voice_distinctiveness` | work | voces indistinguibles | voces muy diferenciadas |
| `character_agency` | work | personajes pasivos | protagonistas activos, deciden todo |

### Dominio 4 — Estilo y voz

| `featureKey` | scope | 0.00 | 1.00 |
|---|---|---|---|
| `style_clarity` | **edition** | opaco/indirecto | muy claro y directo |
| `ornate_prose` | work | prosa seca minimalista | prosa ornamentada/barroca |
| `introspection_density` | work | sin introspección | introspección dominante |
| `repetition_level` | work | sin repetición notoria | repetición marcada, casi leitmotiv |
| `experimentation_level` | work | plenamente convencional | altamente experimental |
| `descriptive_density` | work | mínima descripción | máxima descripción, casi pictórica |
| `dialogue_ratio` | work | casi sin diálogo | dominado por diálogo |

### Dominio 5 — Experiencia emocional

| `featureKey` | scope | 0.00 | 1.00 |
|---|---|---|---|
| `tension_level` | work | sin tensión | tensión constante |
| `comfort_level` | work | muy incómodo | plenamente reconfortante |
| `humor_level` | work | sin humor | humor dominante |
| `darkness_level` | work | ligero/alegre | oscuridad extrema |
| `emotional_intensity` | work | tenue/sereno | intensidad emocional máxima |
| `sadness_level` | work | sin tristeza | duelo o desgarro dominante |
| `strangeness_level` | work | familiar | extrañeza radical |
| `hope_level` | work | desesperanzado | plenamente esperanzador |

### Dominio 6 — Exigencia cognitiva

| `featureKey` | scope | 0.00 | 1.00 |
|---|---|---|---|
| `linguistic_complexity` | **edition** | lenguaje simple | lenguaje muy exigente |
| `structural_complexity` | work | estructura simple | estructura muy compleja |
| `conceptual_density` | work | sin ideas abstractas; la narración no exige procesar conceptos | máxima densidad conceptual: conceptos, reglas o explicaciones casi constantes |
| `cast_size_load` | work | 1–2 personajes | más de 20 |
| `worldbuilding_load` | work | sin worldbuilding | worldbuilding opresivo |
| `attention_demand` | work | lectura ligera | atención sostenida máxima |
| `conceptual_depth` | work | la obra no desarrolla ideas centrales más allá de la trama inmediata | exploración filosófica, ética o conceptual profunda que domina la obra |

> **Distinción obligatoria entre `conceptual_density` y `conceptual_depth` (no son sinónimos):**
> - `conceptual_density` mide **cuántas** ideas abstractas, conceptos, reglas o explicaciones debe
>   procesar el lector y **con qué frecuencia** aparecen (volumen/abundancia de contenido conceptual).
> - `conceptual_depth` mide **qué tan profundamente** desarrolla la obra sus ideas centrales y cuánto
>   las explora, cuestiona o conecta con sus consecuencias (centralidad y desarrollo, no volumen).
> Anclas de `conceptual_depth`:
>   - `0.00`: la obra no desarrolla ideas centrales más allá de la trama inmediata.
>   - `0.25`: presenta una idea reconocible, pero apenas la explora.
>   - `0.50`: desarrolla sus ideas con cierta reflexión y consecuencias visibles.
>   - `0.75`: las ideas son centrales y se exploran desde varias perspectivas o implicaciones.
>   - `1.00`: exploración filosófica, ética o conceptual profunda que domina y transforma la lectura de la obra.
> Ejemplo: un thriller intelectual denso en conceptos pero que los usa como escenografía → alta
> `conceptual_density`, media-baja `conceptual_depth`. Una parábola con pocas ideas pero que las
> sostiene y explora todo el relato → baja-media `conceptual_density`, alta `conceptual_depth`.

---

## 5. Taxonomía de tags (`tag-tax/1.0.1`) — tipos permitidos

`tagType` permitidos (enum cerrado): `genre` · `subgenre` · `theme` · `setting` · `period` ·
`cultural_context` · `narrative_motif`.

El gate de clasificación exige: **≥ 1 `genre`** y **≥ 1 `theme`**; los `subgenre` son condicionales
(ver §6). El resto de tipos aporta contexto (afinidad de tags en scoring) pero no bloquea.

### 5.1 `genre` (23)

`literary_fiction`, `mystery`, `thriller`, `horror`, `romance`, `erotica`, `science_fiction`,
`fantasy`, `historical_fiction`, `adventure`, `comedy`, `speculative_fiction`, `realistic_fiction`,
`narrative_nonfiction`, `essay_memoir`, `short_story_collection`, `history`, `biography_memoir`,
`journalism`, `science`, `politics_society`, `philosophy`, `economics`.

### 5.2 `subgenre` (24)

`cozy_mystery`, `procedural`, `noir`, `hardboiled`, `psychological_thriller`, `spy_thriller`,
`techno_thriller`, `legal_thriller`, `cosmic_horror`, `psychological_horror`, `slasher`,
`gothic_horror`, `space_opera`, `hard_scifi`, `cyberpunk`, `dystopia`, `high_fantasy`,
`urban_fantasy`, `dark_fantasy`, `magical_realism`, `alternate_history`, `slipstream`,
`paranormal_romance`, `satire`.

> Cada subgénero cuelga de un género padre (`parent_tag_key`, persistido por el seed):
> `cozy_mystery`/`procedural`/`noir`/`hardboiled` → `mystery`; `psychological_thriller`/`spy_thriller`/
> `techno_thriller`/`legal_thriller` → `thriller`; `cosmic_horror`/`psychological_horror`/`slasher`/
> `gothic_horror` → `horror`; `space_opera`/`hard_scifi`/`cyberpunk`/`dystopia` →
> `science_fiction`; `high_fantasy`/`urban_fantasy`/`dark_fantasy` → `fantasy`;
> `magical_realism`/`alternate_history`/`slipstream` → `speculative_fiction`; `paranormal_romance` →
> `romance`; `satire` → `comedy`.
> El gate los considera **aplicables** cuando el género seleccionado tiene subgéneros definidos, y en
> ese caso **al menos uno es obligatorio** (ver §6).

### 5.3 `theme` (24)

`love`, `identity`, `grief`, `family`, `friendship`, `betrayal`, `redemption`, `justice`, `power`,
`freedom`, `war`, `migration`, `memory`, `loneliness`, `ambition`, `faith_doubt`,
`technology_society`, `environment`, `mental_health`, `addiction`, `coming_of_age`, `forgiveness`,
`mortality`, `moral_dilemma`.

### 5.4 `setting` (12)

`urban`, `rural`, `small_town`, `arctic`, `desert`, `island`, `maritime`, `mountain`, `war_zone`,
`dystopian_city`, `village`, `metropolis`.

### 5.5 `period` (8)

`pre_1900`, `early_20th_century`, `mid_20th_century`, `late_20th_century`, `contemporary`,
`near_future`, `distant_future`, `mythic_past`.

### 5.6 `cultural_context` (13)

`latin_american`, `hispanic_mexico`, `anglo_united_states`, `anglo_united_kingdom`,
`anglo_american` (**deprecated**, reemplazo `anglo_united_states`), `european`, `east_asian`,
`south_asian`, `southeast_asian`, `middle_eastern`, `african`, `indigenous`, `diaspora`.

### 5.7 `narrative_motif` (14)

`quest`, `forbidden_love`, `chosen_one`, `unreliable_narrator`, `locked_room_mystery`, `time_loop`,
`parallel_worlds`, `found_family`, `redemption_arc`, `fall_of_hero`, `doppelganger`, `secret_history`,
`last_survivor`, `epistolary`.

> No uses tags `deprecated` (hoy solo `anglo_american`); sustituye por su `replacement_tag_key`.

---

## 6. Reglas de validación (para que el JSON pase el gate)

Regla de tags (gate):
```
genres >= 1  AND  themes >= 1  AND  (!subgenreApplicable || subgenres >= 1)
```
`subgenreApplicable` es `true` cuando al menos uno de los `genre` seleccionados tiene subgéneros
definidos en la taxonomía (ver §5.2). En ese caso se exige **≥ 1 subgénero** cuyo `parent_tag_key`
apunte a un genre seleccionado. Si ningún genre seleccionado tiene subgéneros (p. ej. `history`),
`subgenreApplicable` es `false` y no se requiere subgénero.

Features obligatorias por `contentTypeKey` (todas con `value` + `confidence`):

| `contentTypeKey` | Features requeridas |
|---|---|
| `fiction`, `short_stories`, `other` | `hook_speed`, `narrative_pace`, `slow_burn_level`, `narrative_payoff`, `style_clarity`, `ornate_prose`, `linguistic_complexity`, `structural_complexity`, `conceptual_density`, `character_depth`, `character_agency`, `character_likability`, `relationship_focus`, `cast_size_load`, `multi_pov_load`, `introspection_density`, `repetition_level`, `tension_level`, `descriptive_density`, `worldbuilding_load`, `ending_openness` (21) |
| `narrative_nonfiction`, `memoir` | Las 21 anteriores **menos** `worldbuilding_load` (20) |
| `expository_nonfiction` | `hook_speed`, `narrative_pace`, `slow_burn_level`, `narrative_payoff`, `style_clarity`, `ornate_prose`, `linguistic_complexity`, `structural_complexity`, `conceptual_density`, `introspection_density`, `repetition_level`, `descriptive_density`, `tension_level` (13) |
| `essay`, `poetry` | `style_clarity`, `ornate_prose`, `linguistic_complexity`, `structural_complexity`, `conceptual_density`, `introspection_density`, `repetition_level`, `descriptive_density` (8) |

Features **`not_applicable`** (prohibidas de incluir en el JSON para ese content type):
- `expository_nonfiction`, `essay`: `character_depth`, `character_agency`, `character_likability`,
  `relationship_focus`, `cast_size_load`, `multi_pov_load`, `ending_openness`, `worldbuilding_load`.
- `poetry`: las 8 anteriores **más** `dialogue_ratio`.

Restricciones de formato (rechazo con 400 si se violan):
- Feature duplicada o tag duplicado en el array → rechazo.
- Feature desconocida para `book-features/1.0` → rechazo.
- Tag desconocido para `tag-tax/1.0.1` o con `status != active` → rechazo.
- Feature `not_applicable` en el payload → rechazo ("no aplica para {contentTypeKey}").
- `value`/`strength` fuera de `[0, 1]`, o `confidence` fuera de `[0, 0.95]` → rechazo.
- Para aprobar (no solo guardar borrador): todas las requeridas presentes + `configurationErrors` vacío
  + regla de tags. El borrador puede guardarse incompleto; la aprobación lo exige completo.

> **Nota sobre `conceptual_depth` vs `conceptual_density` en el pipeline de elegibilidad:**
> `scoring_required_minimum` (gate de entrada al ranking) incluye `conceptual_depth` pero **no**
> `conceptual_density`. Las 10 que más importan clasificar bien: `hook_speed`, `narrative_pace`,
> `ending_openness`, `character_depth`, `style_clarity`, `tension_level`, `comfort_level`,
> `linguistic_complexity`, `structural_complexity`, `conceptual_depth`.

---

## 7. Ejemplo de salida válida (obra de ficción)

```json
{
  "contentTypeKey": "fiction",
  "contentTypeSchemaVersion": "content-types/1.0",
  "featureSchemaVersion": "book-features/1.0",
  "tagTaxonomyVersion": "tag-tax/1.0.1",
  "features": [
    { "featureKey": "hook_speed", "value": 0.85, "confidence": 0.7, "notes": "Gancho en la primera escena; 3 reseñas lo señalan." },
    { "featureKey": "narrative_pace", "value": 0.6, "confidence": 0.65 },
    { "featureKey": "slow_burn_level", "value": 0.3, "confidence": 0.6 },
    { "featureKey": "narrative_payoff", "value": 0.75, "confidence": 0.65 },
    { "featureKey": "style_clarity", "value": 0.8, "confidence": 0.7 },
    { "featureKey": "ornate_prose", "value": 0.4, "confidence": 0.6 },
    { "featureKey": "linguistic_complexity", "value": 0.5, "confidence": 0.6 },
    { "featureKey": "structural_complexity", "value": 0.4, "confidence": 0.6 },
    { "featureKey": "conceptual_density", "value": 0.6, "confidence": 0.6 },
    { "featureKey": "conceptual_depth", "value": 0.7, "confidence": 0.65, "notes": "Las ideas sobre identidad estructuran toda la obra." },
    { "featureKey": "character_depth", "value": 0.7, "confidence": 0.65 },
    { "featureKey": "character_agency", "value": 0.6, "confidence": 0.6 },
    { "featureKey": "character_likability", "value": 0.6, "confidence": 0.6 },
    { "featureKey": "relationship_focus", "value": 0.7, "confidence": 0.65 },
    { "featureKey": "cast_size_load", "value": 0.3, "confidence": 0.7 },
    { "featureKey": "multi_pov_load", "value": 0.3, "confidence": 0.7 },
    { "featureKey": "introspection_density", "value": 0.65, "confidence": 0.6 },
    { "featureKey": "repetition_level", "value": 0.4, "confidence": 0.6 },
    { "featureKey": "tension_level", "value": 0.55, "confidence": 0.6 },
    { "featureKey": "descriptive_density", "value": 0.5, "confidence": 0.6 },
    { "featureKey": "worldbuilding_load", "value": 0.3, "confidence": 0.7 },
    { "featureKey": "ending_openness", "value": 0.35, "confidence": 0.6 }
  ],
  "tags": [
    { "tagKey": "science_fiction", "strength": 0.9, "confidence": 0.7 },
    { "tagKey": "identity", "strength": 0.7, "confidence": 0.65 },
    { "tagKey": "space_opera", "strength": 0.8, "confidence": 0.6 },
    { "tagKey": "coming_of_age", "strength": 0.5, "confidence": 0.6 },
    { "tagKey": "near_future", "strength": 0.6, "confidence": 0.6 }
  ]
}
```

---

## 8. Checklist final antes de entregar el JSON

- [ ] Investigué al menos 3 reseñas (cuando existen) además de la sinopsis y la muestra de texto.
- [ ] `contentTypeKey` correcto y sus features requeridas todas presentes con `value` y `confidence`.
- [ ] Ninguna feature `not_applicable` incluida.
- [ ] `conceptual_density` (volumen/frecuencia de ideas) y `conceptual_depth` (desarrollo y centralidad de ideas) evaluados por separado contra sus anclas.
- [ ] Al menos 1 `genre` y 1 `theme`; ningún tag inexistente ni `deprecated`.
- [ ] `value`/`strength` en `[0,1]`, `confidence` en `[0,0.95]`, 4 decimales máximo.
- [ ] `confidence ≤ 0.40` si la única fuente es IA; sin `0.5` por defecto "no sé".
- [ ] El JSON es válido y autocontenido (sin texto adicional).
