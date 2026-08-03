# Prompt reutilizable: clasificación de libros

> **Objetivo:** dado un libro (obra + edición) y este prompt, producir un JSON de clasificación válido
> que pueda guardarse directamente en el editor de clasificaciones del admin.
> Versión de contrato: `book-features/1.0` · `content-types/1.0` · `tag-tax/1.0.1`.

---

## 0. Rol e instrucciones generales

Actúa como curador editorial experto. Antes de asignar cualquier valor:

1. **Clasifica usando los metadatos, el texto del libro y el contexto externo que aparezcan en el
   mensaje del usuario.** El mensaje puede incluir una sección `### Contexto externo (fuentes
   públicas)` (p. ej. OpenLibrary o Google Books) con sinopsis, temas y categorías: úsala **solo**
   para trama, personajes, temas y tono. Las features técnicas de prosa, estilo y densidad se evalúan
   **exclusivamente** con el texto del libro proporcionado. No afirmes haber consultado fuentes que no
   estén incluidas en la petición.
2. **Puedes usar conocimiento previo** sobre una obra conocida únicamente como apoyo secundario, pero
   los valores deben ser compatibles con el texto suministrado.
3. **Debes incluir TODAS las features aplicables al contentTypeKey indicado, tanto requeridas como
   opcionales. No omitas ninguna** (la lista completa de cobertura está en el apéndice del system
   prompt). Cuando la evidencia sea limitada, asigna el valor más razonable según las anclas de §4 y
   reduce la `confidence`. **No uses `value = 0.5` como sustituto automático de desconocimiento.**
4. **Todo valor se justifica mentalmente contra la ancla semántica** de la feature (ver §4): elige el
   valor de la escala que mejor describa el libro, no el que "se sienta bien".
5. Solo puedes proponer **tags que existan** en la taxonomía (§5). No inventes claves.
6. Asigna **al menos 1 genre y 1 theme** obligatorios; los subgéneros van solo si aplican (ver §6).
7. No emitas texto fuera del bloque JSON: la salida debe ser **un único JSON válido** con la forma
   `{ "features": { <featureKey>: { "value": …, "confidence": … } }, "tags": { <tagKey>: { "strength": …, "confidence": … } } }`,
   sin markdown alrededor.

---

## 1. Formato JSON exacto esperado

La salida de la IA es un objeto con dos claves, `features` y `tags`, cada una como **objeto indexado
por clave** (el formato que pega el editor manual de clasificaciones). No uses arrays ni claves
internas `featureKey`/`tagKey`.

```json
{
  "features": {
    "hook_speed": { "value": 0.75, "confidence": 0.65 },
    "narrative_pace": { "value": 0.6, "confidence": 0.65 }
  },
  "tags": {
    "science_fiction": { "strength": 0.9, "confidence": 0.7 },
    "identity": { "strength": 0.6, "confidence": 0.6 }
  }
}
```

Formato **correcto** de `features` (las claves son `featureKey`):

```json
{
  "hook_speed": { "value": 0.75, "confidence": 0.7 },
  "narrative_pace": { "value": 0.6, "confidence": 0.65 }
}
```

Formato **correcto** de `tags` (las claves son `tagKey`):

```json
{
  "science_fiction": { "strength": 0.9, "confidence": 0.85 },
  "identity": { "strength": 0.7, "confidence": 0.65 }
}
```

Formato **incorrecto** (nunca arrays de objetos):

```json
[
  { "featureKey": "hook_speed", "value": 0.75, "confidence": 0.7 }
]
```

```json
[
  { "tagKey": "science_fiction", "strength": 0.9, "confidence": 0.85 }
]
```

> El editor manual pega cada objeto por separado: el objeto `features` en el cuadro de features y el
> objeto `tags` en el cuadro de tags. El `contentTypeKey` y las versiones de esquema pertenecen al
> borrador abierto; la IA solo devuelve `features` y `tags`.

Reglas de forma:
- `features`: objeto cuyas **claves** son `featureKey` válidos en `book-features/1.0` que **no** sean
  `not_applicable` para el `contentTypeKey` del borrador. Cada entrada: `{ "value": 0..1,
  "confidence": 0..0.95 }`.
- `tags`: objeto cuyas **claves** son `tagKey` existentes en `tag-tax/1.0.1` con `status: active`.
  Cada entrada: `{ "strength": 0..1, "confidence": 0..0.95 }`.
- Deben incluirse **todas** las features aplicables al `contentTypeKey` del borrador (requeridas y
  opcionales); **no omitas ninguna**. Nunca incluyas una feature `not_applicable`.
- Sin arrays; sin claves internas `featureKey`/`tagKey`; cada clave única.

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

Semántica de `confidence`:
- `confidence < 0.20` equivale a ausencia a efectos de elegibilidad/scoring.

Escala de `value` (cuánto está presente una característica en la experiencia del libro; **no** es
calidad ni seguridad de la clasificación):
- `0.00` — prácticamente ausente o extremo inferior de la feature.
- `0.25` — presencia baja.
- `0.50` — presencia intermedia.
- `0.75` — presencia alta.
- `1.00` — presencia extrema o característica dominante.
Puedes usar valores intermedios en incrementos de `0.05` cuando las anclas de §4 lo justifiquen.

Escala de `confidence` (qué tan sólida es la evidencia para el `value` o `strength` asignado; **no**
es intensidad, calidad ni relevancia):
- `0.90–0.95` — evidencia directa, abundante y consistente.
- `0.75–0.85` — evidencia clara y repetida en varias partes.
- `0.60–0.70` — inferencia razonable con evidencia suficiente.
- `0.40–0.55` — evidencia parcial o ambigua.
- `0.20–0.35` — estimación débil, necesaria únicamente por la regla de cobertura completa.
- `< 0.20` — equivale a ausencia a efectos de elegibilidad/scoring.

Evalúa la `confidence` de manera independiente para cada feature y cada tag; no la repitas de forma
uniforme.

La muestra incluye páginas del inicio, la parte media y el final del libro. Aunque no contenga la
obra completa, puede aportar evidencia sólida sobre muchas características. **Que el texto esté
incompleto no establece un límite global para `confidence`.**

Las features directamente observables en la muestra pueden recibir `confidence` alta, especialmente:
- estilo y claridad del lenguaje;
- complejidad lingüística;
- voz narrativa;
- cantidad de diálogo;
- repetición;
- densidad descriptiva;
- estructura;
- número de puntos de vista;
- fragmentación temporal;
- profundidad conceptual;
- enfoque en relaciones;
- carga de personajes.

Usa `confidence` baja solamente cuando la evidencia específica de esa feature sea limitada,
contradictoria o dependa de partes de la obra que no están presentes. No simules variedad alternando
mecánicamente entre `0.30`, `0.35` y `0.40`; usa toda la escala cuando la evidencia lo justifique.

Antes de responder, revisa si todas las `confidence` están concentradas artificialmente en un rango
pequeño. Si la mayoría están entre `0.30` y `0.40`, vuelve a evaluar cada elemento usando la
evidencia concreta disponible.

Las features o tags derivados **principalmente del contexto externo** (sinopsis/reseñas etiquetadas,
no del texto del libro) deben usar la banda de inferencia (`0.60–0.70`), nunca la banda de evidencia
directa.

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

### Distinciones entre features relacionadas

- `narrative_pace` mide la sensación de avance durante la lectura. `event_density` mide la cantidad de
  acontecimientos relevantes por unidad narrativa. `slow_burn_level` mide cuánto tarda el libro en
  desarrollar su interés, conflicto o recompensa; **no** es simplemente el inverso de `narrative_pace`.
- `style_clarity` mide qué tan directa y comprensible es la expresión. `ornate_prose` mide el nivel de
  ornamentación verbal y sintáctica: una prosa lírica, bella o distintiva puede tener `ornate_prose` bajo.
  `voice_distinctiveness` mide qué tan reconocible y singular es la voz narrativa, no su dificultad.
- `repetition_level` mide qué tan perceptible resulta la repetición de palabras, ideas, escenas,
  explicaciones o estructuras. La reaparición deliberada de un símbolo no basta por sí sola para un
  valor alto.
- `descriptive_density` mide cuánto espacio ocupa la descripción detallada; no debe confundirse con
  `worldbuilding_load`.
- `character_depth` mide complejidad psicológica, contradicciones, evolución e interioridad. La
  importancia simbólica o temática de un personaje no implica automáticamente alta profundidad
  psicológica. `character_agency` mide cuánto influyen las decisiones de los personajes en la narración.
- `linguistic_complexity` mide la dificultad de vocabulario, sintaxis y expresión;
  `structural_complexity` mide la dificultad de la organización narrativa; `conceptual_density` mide
  cuántas ideas sustanciales se concentran por unidad de texto; `conceptual_depth` mide hasta qué punto
  esas ideas permiten desarrollo, reflexión o interpretación profunda; `attention_demand` mide el
  esfuerzo necesario para seguir el texto y captar información, relaciones o subtexto.
- `ambiguity` mide la incertidumbre interpretativa general; `ending_openness` mide específicamente cuánto
  deja el desenlace sin resolver.
- `strangeness_level` mide qué tan alejada está la lógica narrativa de la experiencia cotidiana; un
  libro puede ser extraño y a la vez muy claro y lingüísticamente sencillo.
- `introspection_density` mide cuánto espacio se dedica a pensamientos, reflexiones internas o
  contemplación; no equivale automáticamente a `conceptual_depth`.

---

## 5. Taxonomía de tags (`tag-tax/1.0.1`) — tipos permitidos

`tagType` permitidos (enum cerrado): `genre` · `subgenre` · `theme` · `setting` · `period` ·
`cultural_context` · `narrative_motif`.

El gate de clasificación exige: **≥ 1 `genre`** y **≥ 1 `theme`**; los `subgenre` son condicionales
(ver §6). El resto de tipos aporta contexto (afinidad de tags en scoring) pero no bloquea.

Escala de `strength` (qué tan central, persistente y representativo es un tag dentro de la
experiencia completa del libro):
- `0.90–1.00` — elemento central o definitorio.
- `0.70–0.85` — presencia importante y recurrente.
- `0.50–0.65` — presencia clara pero secundaria.
- `0.30–0.45` — presencia limitada.
- `< 0.30` — normalmente no incluir el tag; no agregues tags solo por apariciones puntuales.

Criterios por tipo de tag:
- `genre`: solo géneros que describan realmente la obra; no aumentes cobertura artificialmente.
- `subgenre`: solo subgéneros existentes y compatibles con un `genre` seleccionado; no inventes claves.
- `theme`: solo cuando el tema tenga presencia narrativa o conceptual significativa; una sola mención no basta.
- `setting`: `strength` debe reflejar cuánto define el lugar la experiencia completa, no solo si una escena ocurre ahí.
- `period`: representa el periodo de la narración; no debe inferirse solo del año de publicación.
- `cultural_context`: presencia cultural significativa dentro de la obra; no se asigna solo por la nacionalidad del autor.
- `narrative_motif`: estructura o motivo importante de la narración; no por semejanza superficial.

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

No todos los libros deben tener `subgenre`. Incluye un subgenre solamente cuando (1) exista en la
taxonomía actual, (2) corresponda a uno de los `genre` seleccionados y (3) describa realmente la obra.
Si no existe un subgenre adecuado y `subgenreApplicable` es `false`, no inventes uno.

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

Restricciones de formato (para que el JSON sea aceptado y la clasificación pase el gate):
- `features` y `tags` son **objetos indexados por clave** (sin arrays ni claves internas
  `featureKey`/`tagKey`); claves únicas.
- Clave desconocida en `features` (no existe en `book-features/1.0`) o en `tags` (no existe en
  `tag-tax/1.0.1` o `status != active`) → se ignora/descarta.
- Feature `not_applicable` para el `contentTypeKey` del borrador → se ignora/descarta ("no aplica
  para {contentTypeKey}").
- `value`/`strength` fuera de `[0, 1]`, o `confidence` fuera de `[0, 0.95]` → el editor acota, pero
  la salida debe respetar el rango.
- Para aprobar (no solo guardar borrador): todas las requeridas presentes + `configurationErrors` vacío
  + regla de tags. El borrador puede guardarse incompleto; la aprobación lo exige completo.

> **Nota sobre `conceptual_depth` vs `conceptual_density` en el pipeline de elegibilidad:**
> `scoring_required_minimum` (gate de entrada al ranking) incluye `conceptual_depth` pero **no**
> `conceptual_density`. Las 10 que más importan clasificar bien: `hook_speed`, `narrative_pace`,
> `ending_openness`, `character_depth`, `style_clarity`, `tension_level`, `comfort_level`,
> `linguistic_complexity`, `structural_complexity`, `conceptual_depth`.

---

## 6.1 Revisión interna antes de responder

Antes de producir el JSON, comprueba mentalmente (sin incluirlo en la salida):

1. Todas las features aplicables están presentes.
2. Cada `value` se comparó contra sus anclas de §4.
3. La `confidence` no es uniforme por defecto y usa toda la escala hasta `0.95` según la evidencia concreta de cada feature/tag.
4. No confundiste `value` con `confidence`.
5. Hay coherencia semántica entre: `narrative_pace`↔`slow_burn_level`, `narrative_pace`↔`event_density`,
   `style_clarity`↔`ornate_prose`, `ornate_prose`↔`voice_distinctiveness`,
   `linguistic_complexity`↔`attention_demand`, `conceptual_density`↔`conceptual_depth`,
   `ambiguity`↔`ending_openness`, `descriptive_density`↔`worldbuilding_load`.
6. `period` no proviene solo del año de publicación.
7. `cultural_context` no proviene solo de la nacionalidad del autor.
8. No hay tags débiles ni basados en apariciones puntuales.
9. Todos los `tagKey` pertenecen a la taxonomía proporcionada.
10. La salida es un único objeto JSON válido, sin texto adicional.

---

## 7. Ejemplo de salida válida (obra de ficción)

```json
{
  "features": {
    "hook_speed": { "value": 0.85, "confidence": 0.7 },
    "narrative_pace": { "value": 0.6, "confidence": 0.65 },
    "slow_burn_level": { "value": 0.3, "confidence": 0.6 },
    "narrative_payoff": { "value": 0.75, "confidence": 0.65 },
    "style_clarity": { "value": 0.8, "confidence": 0.7 },
    "ornate_prose": { "value": 0.4, "confidence": 0.6 },
    "linguistic_complexity": { "value": 0.5, "confidence": 0.6 },
    "structural_complexity": { "value": 0.4, "confidence": 0.6 },
    "conceptual_density": { "value": 0.6, "confidence": 0.6 },
    "conceptual_depth": { "value": 0.7, "confidence": 0.65 },
    "character_depth": { "value": 0.7, "confidence": 0.65 },
    "character_agency": { "value": 0.6, "confidence": 0.6 },
    "character_likability": { "value": 0.6, "confidence": 0.6 },
    "relationship_focus": { "value": 0.7, "confidence": 0.65 },
    "cast_size_load": { "value": 0.3, "confidence": 0.7 },
    "multi_pov_load": { "value": 0.3, "confidence": 0.7 },
    "introspection_density": { "value": 0.65, "confidence": 0.6 },
    "repetition_level": { "value": 0.4, "confidence": 0.6 },
    "tension_level": { "value": 0.55, "confidence": 0.6 },
    "descriptive_density": { "value": 0.5, "confidence": 0.6 },
    "worldbuilding_load": { "value": 0.3, "confidence": 0.7 },
    "ending_openness": { "value": 0.35, "confidence": 0.6 }
  },
  "tags": {
    "science_fiction": { "strength": 0.9, "confidence": 0.7 },
    "identity": { "strength": 0.7, "confidence": 0.65 },
    "space_opera": { "strength": 0.8, "confidence": 0.6 },
    "coming_of_age": { "strength": 0.5, "confidence": 0.6 },
    "near_future": { "strength": 0.6, "confidence": 0.6 }
  }
}
```

---

## 8. Checklist final antes de entregar el JSON

- [ ] Clasifiqué usando los metadatos, el texto del libro y el contexto externo incluidos en el mensaje; no afirmé haber consultado fuentes que no estaban en la petición.
- [ ] Incluí todas las features aplicables (requeridas y opcionales); ninguna quedó omitida.
- [ ] Salida con la forma exacta `{ "features": { … }, "tags": { … } }`, sin arrays ni claves internas `featureKey`/`tagKey`.
- [ ] Las features requeridas del `contentTypeKey` del borrador están todas presentes con `value` y `confidence`.
- [ ] Ninguna feature `not_applicable` incluida.
- [ ] `conceptual_density` (volumen/frecuencia de ideas) y `conceptual_depth` (desarrollo y centralidad de ideas) evaluados por separado contra sus anclas.
- [ ] Al menos 1 `genre` y 1 `theme`; ningún tag inexistente ni `deprecated`.
- [ ] `value`/`strength` en `[0,1]`, `confidence` en `[0,0.95]`, 4 decimales máximo.
- [ ] `confidence ≤ 0.95` (cap del pipeline) con toda la escala según la evidencia de cada feature/tag; sin `0.5` por defecto "no sé".
- [ ] El JSON es válido, autocontenido y sin texto adicional.
