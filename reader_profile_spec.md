# Especificación técnica: perfil lector, cuestionario y aprendizaje por feedback

**Documento:** `reader_profile_spec.md`
**Versión:** `1.1.1`
**Estado:** correcciones normativas tras revisión transversal (v1.1.0 + ajustes)
**Audiencia:** agentes de programación, backend, frontend, producto y curaduría editorial
**Idioma de producto inicial:** español de México
**Persistencia recomendada:** PostgreSQL 16 con `JSONB`

**Documentos normativos complementarios (lectura obligatoria):**

- `book_taxonomy_spec.md` v1.1 — catálogo canónico de `book_feature_key` (incluye `conceptual_depth`), clasificación, confianza del libro, elegibilidad escalada (`scoring_required_minimum` 10, `core_optional_for_scoring` 20), revisión humana, separación obra/edición + `series` + `authors` + `book_authors`.
- `scoring_weights_spec.md` v1.1 — `numeric_fit_score` con `effective_weight`, sin `coverage_adjustment` ni `low_evidence_penalty`; sin `tag_domain_weight`; mapeo `ideas → conceptual_depth_appreciation`; `null` sin imputar `0.5`; `effort_fit` con `available_energy`; `goal_fit_combined` con `secondary_goals`; `author_novelty_indicator` en `discovery_fit_score`; coverage y maturity como metricas diagnosticas.
- `tag_taxonomy_v1.md` v1.0.1 — catálogo cerrado y versionado de etiquetas con `tag_identity` + `tag_versions`; split `cultural_context`; no ficción ampliada.

## Changelog 1.1.1

- `question_definitions`: `UNIQUE(question_key, version)` en lugar de `question_key` UNIQUE.
- `reader_evidence`: quita `evidence_set_hash` (vive en `reader_profile_versions.snapshot_json`); añade `status`, `superseded_by`, `deactivated_at`.
- Añade `profile_version_evidence` (tabla inmutable) para reconstruir exactamente las evidencias que alimentan cada snapshot.
- `tag_definitions` reemplazado por `tag_identity` + `tag_versions` (ver `tag_taxonomy_v1.md` §11).
- `books.author_ids UUID[]` reemplazado por `authors` + `book_authors`.
- `direction` en `reader_evidence` queda definido explícitamente: `+1` evidencia a favor del valor observado; `-1` evidencia en contra. No participa en pesos, sí en reglas condicionales y agregación Bayesiana futura.
- Prueba de recomputación aclarada: sin cambios devuelve la misma `profile_version`; snapshot nuevo sólo si cambia el conjunto de evidencia o `calculation_version`.
- `reading_requests` añade `budget_amount`, `budget_currency`, `delivery_region`, `allow_used_books`, `secondary_goals`.
- `series_membership` enum en `books`; filtros por saga (`first_in_series_only`, `series_welcome_in_order`, etc.) en §14.1.
- `length_fit` / `reading_time_fit` por unidad de edición (audiobook usa `audio_minutes`).
- `available_energy` modula `effort_fit` (context).
- Mappings normativos completos para Q09/Q10/F05/F06 (option_key → dimension_key/tag_key → observed_value → reason_code → base_weight). Preguntas `is_required` listadas.
- JSON Schema cerrado para `conditional_rules` con efectos `{block, penalty, review}`.
- Catálogo cerrado de `soft_aversion_definitions` con mapping a condiciones sobre features/tags.
- `onboarding_core_dimensions` (12), `onboarding_core_coverage` y `global_profile_coverage` son metricas diagnosticas; no son gates de `ready_to_recommend`.
- `conceptual_depth_appreciation` añadida al Dominio 6 del lector.
- §27: matriz automatizable de invariantes cross-document y auditoría de keys usadas vs definidas.  

---

## 1. Objetivo

Construir un sistema de perfilado lector que permita seleccionar manualmente libros sorpresa de forma consistente durante el MVP y que, al mismo tiempo, genere datos ordenados para automatizar recomendaciones en el futuro.

El sistema **no implementará machine learning en la primera versión**. Debe almacenar información con suficiente estructura, trazabilidad y versionado para que posteriormente sea posible entrenar modelos de recomendación, ranking o clasificación sin rehacer la base de datos.

El producto debe aprender mediante este ciclo:

1. El usuario responde un cuestionario inicial.
2. El sistema genera una hipótesis de perfil lector.
3. Un curador selecciona el libro con apoyo de un scoring determinista.
4. El usuario recibe y lee el libro.
5. El usuario responde un cuestionario breve de seguimiento.
6. El sistema transforma esas respuestas en evidencia.
7. El perfil se actualiza sin perder la evidencia ni las versiones anteriores.
8. La siguiente selección utiliza el nuevo perfil y el contexto actual.

---

## 2. Principios obligatorios de diseño

1. **No usar tipos rígidos de lector como fuente de verdad.** Etiquetas como “lector aventurero” pueden mostrarse al usuario, pero no sustituyen al perfil multidimensional.
2. **Separar persona, momento y libro.** El gusto histórico del lector no es lo mismo que lo que necesita en la compra actual.
3. **Usar la misma taxonomía para lectores y libros.** Cada rasgo del lector debe poder compararse con un rasgo equivalente o compatible del libro.
4. **Guardar respuestas originales e interpretaciones por separado.** Nunca conservar únicamente el valor normalizado.
5. **No sobrescribir evidencia.** Cada cambio del perfil debe poder explicarse y reconstruirse.
6. **La IA no define pesos, escalas ni confianza.** La IA puede estructurar texto libre dentro de un esquema cerrado; el backend calcula el perfil.
7. **Una ausencia de información no equivale a una preferencia neutral.** Desconocido se representa con `value = null` y `confidence = 0`.
8. **Las restricciones privadas no se muestran públicamente.** Cualquier exclusión personal debe ser editable, opcional y privada.
9. **El MVP mantiene curaduría humana.** El sistema genera candidatos y explicaciones; un humano confirma el libro enviado.
10. **Toda taxonomía y pregunta debe estar versionada.** Los datos históricos deben conservar el significado que tenían al momento de capturarse.

---

## 3. Convenciones de datos

### 3.1 Escala numérica canónica

Todos los valores continuos internos usan `NUMERIC(5,4)` o un tipo decimal equivalente en el rango `0.0000` a `1.0000`.

| Concepto | Rango | Significado |
|---|---:|---|
| Valor de dimensión | `0..1` o `null` | Posición estimada del lector sobre un eje |
| Confianza | `0..1` | Madurez y consistencia de la evidencia |
| Valor observado | `0..1` | Valor sugerido por una evidencia individual |
| Afinidad de etiqueta | `-1..1` | Evita, neutral/desconocido o prefiere |
| Peso final de evidencia | `0..2` recomendado | Fuerza relativa de una evidencia |
| Progreso de lectura | `0..100` | Porcentaje estimado leído |
| Calificación visible | `1..5` | Respuesta directa del usuario |
| Tiempo | minutos | Nunca guardar “corto/largo” sin su valor normalizado adicional |
| Longitud | páginas | Entero positivo |

### 3.2 Conversión de escalas visibles

Las preguntas visibles de 1 a 5 se convierten así:

| Respuesta | Valor normalizado |
|---:|---:|
| 1 | `0.00` |
| 2 | `0.25` |
| 3 | `0.50` |
| 4 | `0.75` |
| 5 | `1.00` |

### 3.3 Desconocido versus neutral

```json
{
  "value": null,
  "confidence": 0.0,
  "evidence_count": 0
}
```

- `null`: no existe información suficiente.
- `0.50`: el usuario expresó una preferencia intermedia o neutral.
- Nunca inicializar dimensiones desconocidas con `0.50`.

### 3.4 Nomenclatura

- Claves internas en inglés y `snake_case`.
- Textos visibles en español.
- Los enums se almacenan como claves estables, no como la etiqueta visible.
- No permitir claves de dimensión inventadas en tiempo de ejecución.

---

## 4. Modelo conceptual de dominios

El perfil se organiza en diez dominios. No todos se modelan igual: algunos son dimensiones numéricas, otros etiquetas, restricciones o contexto temporal.

### 4.1 Tipos de dimensión

Cada definición de dimensión debe declarar un `dimension_kind`:

| Tipo | Uso | Ejemplo |
|---|---|---|
| `target` | El lector prefiere un punto concreto del eje | Ritmo lento ↔ rápido |
| `minimum_required` | El libro debe alcanzar al menos este valor | Necesidad de gancho temprano |
| `maximum_tolerated` | El libro no debería superar este valor | Ambigüedad tolerada |
| `importance` | Peso relativo de un factor para el lector | Importancia de personajes |
| `selection_control` | Modifica exploración o ranking, no describe el libro | Deseo de sorpresa |

Cada dimensión debe asociarse a una característica de libro mediante `book_feature_key` y un `matching_operator`.

---

## 5. Registro inicial de dimensiones

### Dominio 1: tracción narrativa y ritmo

| `dimension_key` | Tipo | Rango semántico `0 → 1` | `book_feature_key` | Operador |
|---|---|---|---|---|
| `hook_need` | `minimum_required` | paciente → necesita gancho inmediato | `hook_speed` | penalizar si el libro queda por debajo |
| `pace_preference` | `target` | lento → rápido | `narrative_pace` | distancia absoluta |
| `event_density_preference` | `target` | pocos eventos → muchos eventos | `event_density` | distancia absoluta |
| `slow_burn_tolerance` | `maximum_tolerated` invertido por regla | tolerancia baja → alta | `slow_burn_level` | penalizar si el libro supera la tolerancia |
| `payoff_requirement` | `minimum_required` | acepta contemplación → exige recompensa clara | `narrative_payoff` | penalizar si el libro queda por debajo |

### Dominio 2: estructura, claridad y cierre

| `dimension_key` | Tipo | Rango semántico `0 → 1` | `book_feature_key` | Operador |
|---|---|---|---|---|
| `linearity_preference` | `target` | fragmentado/no lineal → lineal | `linearity` | distancia absoluta |
| `multi_pov_tolerance` | `maximum_tolerated` | tolerancia baja → alta | `multi_pov_load` | umbral máximo |
| `temporal_fragmentation_tolerance` | `maximum_tolerated` | tolerancia baja → alta | `temporal_fragmentation` | umbral máximo |
| `ambiguity_tolerance` | `maximum_tolerated` | tolerancia baja → alta | `ambiguity` | umbral máximo |
| `open_ending_tolerance` | `maximum_tolerated` | exige cierre → acepta final abierto | `ending_openness` | umbral máximo |
| `conflict_clarity_need` | `minimum_required` | no necesita claridad → exige entender qué está en juego | `conflict_clarity` | umbral mínimo |

### Dominio 3: personajes y relaciones

| `dimension_key` | Tipo | Rango semántico `0 → 1` | `book_feature_key` | Operador |
|---|---|---|---|---|
| `character_depth_need` | `minimum_required` | baja → alta necesidad | `character_depth` | umbral mínimo |
| `character_likability_need` | `minimum_required` | acepta personajes desagradables → necesita simpatía | `character_likability` | umbral mínimo |
| `moral_ambiguity_tolerance` | `maximum_tolerated` | baja → alta | `moral_ambiguity` | umbral máximo |
| `relationship_focus_preference` | `target` | poco enfoque → mucho enfoque | `relationship_focus` | distancia absoluta |
| `distinct_voice_need` | `minimum_required` | no importa → voces claramente diferenciadas | `voice_distinctiveness` | umbral mínimo |
| `character_agency_preference` | `target` | personajes pasivos → personajes activos/competentes | `character_agency` | distancia absoluta |

### Dominio 4: estilo y voz

| `dimension_key` | Tipo | Rango semántico `0 → 1` | `book_feature_key` | Operador |
|---|---|---|---|---|
| `style_clarity_preference` | `target` | opaco/indirecto → claro/directo | `style_clarity` | distancia absoluta |
| `ornate_prose_tolerance` | `maximum_tolerated` | baja → alta | `ornate_prose` | umbral máximo |
| `introspection_tolerance` | `maximum_tolerated` | baja → alta | `introspection_density` | umbral máximo |
| `repetition_tolerance` | `maximum_tolerated` | baja → alta | `repetition_level` | umbral máximo |
| `experimentation_tolerance` | `maximum_tolerated` | convencional → experimental | `experimentation_level` | umbral máximo |
| `descriptive_density_preference` | `target` | poca descripción → mucha descripción | `descriptive_density` | distancia absoluta |
| `dialogue_preference` | `target` | narración → diálogo | `dialogue_ratio` | distancia absoluta |

### Dominio 5: experiencia emocional

| `dimension_key` | Tipo | Rango semántico `0 → 1` | `book_feature_key` | Operador |
|---|---|---|---|---|
| `tension_preference` | `target` | baja → alta | `tension_level` | distancia absoluta |
| `comfort_preference` | `target` | incómodo → reconfortante | `comfort_level` | distancia absoluta |
| `humor_preference` | `target` | serio → humor frecuente | `humor_level` | distancia absoluta |
| `darkness_tolerance` | `maximum_tolerated` | baja → alta | `darkness_level` | umbral máximo |
| `emotional_intensity_preference` | `target` | tenue → intensa | `emotional_intensity` | distancia absoluta |
| `sadness_tolerance` | `maximum_tolerated` | baja → alta | `sadness_level` | umbral máximo |
| `strangeness_preference` | `target` | familiar → extraño | `strangeness_level` | distancia absoluta |
| `hope_preference` | `target` | desesperanzado → esperanzador | `hope_level` | distancia absoluta |

### Dominio 6: exigencia cognitiva

| `dimension_key` | Tipo | Rango semántico `0 → 1` | `book_feature_key` | Operador |
|---|---|---|---|---|
| `linguistic_complexity_tolerance` | `maximum_tolerated` | baja → alta | `linguistic_complexity` | umbral máximo |
| `structural_complexity_tolerance` | `maximum_tolerated` | baja → alta | `structural_complexity` | umbral máximo |
| `conceptual_density_tolerance` | `maximum_tolerated` | baja → alta | `conceptual_density` | umbral máximo |
| `cast_size_tolerance` | `maximum_tolerated` | pocos personajes → elenco amplio | `cast_size_load` | umbral máximo |
| `worldbuilding_load_tolerance` | `maximum_tolerated` | baja → alta | `worldbuilding_load` | umbral máximo |
| `sustained_attention_tolerance` | `maximum_tolerated` | baja → alta | `attention_demand` | umbral máximo |
| `conceptual_depth_appreciation` | `target` | sin ideas abstractas → ideas centrales al libro | `conceptual_depth` | distancia absoluta |

### Dominio 7: géneros, temas y ambientación

Este dominio usa etiquetas, no un único valor continuo. El **catálogo cerrado y versionado** de etiquetas junto con las reglas de gobernanza (alta, fusión, retiro, aliases) se define en **`tag_taxonomy_v1.md`**. La coincidencia para `tag_fit_score` está en `scoring_weights_spec.md` §5.3.

Cada etiqueta se almacena con:

```json
{
  "tag_key": "psychological_thriller",
  "tag_type": "genre",
  "affinity": 0.9,
  "confidence": 0.7,
  "source": "questionnaire"
}
```

Rangos de `affinity`:

| Afinidad | Interpretación |
|---:|---|
| `-1.00` | evitar |
| `-0.50` | aversión suave |
| `0.00` | desconocido o neutral |
| `0.50` | curiosidad |
| `1.00` | preferencia fuerte |

Tipos iniciales de etiqueta:

- `genre`
- `subgenre`
- `theme`
- `setting`
- `period`
- `cultural_context`
- `narrative_motif`

### Dominio 8: restricciones de consumo

No son gustos numéricos. Se guardan como restricciones estructuradas:

- páginas mínimas y máximas aceptadas;
- libro independiente o saga;
- idiomas aceptados;
- formatos aceptados;
- edición física, ebook o audio;
- duración máxima de audiolibro;
- presupuesto por pedido;
- disponibilidad comercial;
- exclusiones privadas opcionales.

### Dominio 9: descubrimiento y sorpresa

| `dimension_key` | Tipo | Rango semántico `0 → 1` |
|---|---|---|
| `discovery_appetite` | `selection_control` | apuesta segura → sorpresa amplia |
| `genre_exploration_openness` | `selection_control` | solo géneros conocidos → géneros nuevos |
| `author_novelty_openness` | `selection_control` | autores conocidos → autores desconocidos |
| `long_tail_openness` | `selection_control` | popularidad alta → títulos de nicho |

En el MVP, únicamente `discovery_appetite` es obligatorio. Las demás pueden derivarse de historial futuro.

### Dominio 10: contexto e intención actual

Este dominio no se guarda dentro del perfil estable. Se crea por pedido en `reading_request`.

Campos iniciales:

- `primary_goal`
- `secondary_goals[]`
- `desired_emotions[]`
- `available_energy` `0..1`
- `reading_time_minutes_per_week`
- `requested_discovery_level` `0..1`
- `preferred_max_pages`
- `accepted_formats[]`
- `special_note`

Valores sugeridos para `primary_goal`:

- `disconnect`
- `leave_reading_slump`
- `learn`
- `feel_tension`
- `comfort`
- `catharsis`
- `challenge`
- `short_read`
- `immersion`
- `discovery`

---

## 6. Cuestionario inicial

### 6.1 Decisión de producto

- Duración objetivo: 5 a 7 minutos.
- No mostrar una lista de 100 libros como requisito.
- Permitir buscar títulos conocidos mediante autocompletado.
- Las preguntas sobre libros previos son opcionales.
- Usar 12 a 14 ítems principales distribuidos en pantallas cortas.
- Aplicar como máximo tres preguntas de ramificación.
- La IA no inventa preguntas nuevas; selecciona únicamente preguntas versionadas del banco aprobado.

### 6.2 Banco inicial de preguntas

Cada pregunta y cada opción del banco son **inmutables por versión**: una vez publicadas con un `questionnaire_version` no se editsan sus textos, mapeos de evidencia ni fragmentos-estímulo. Cualquier cambio requiere nueva `questionnaire_version`. El `question_definition` y el `question_option_mapping` persisten el `version` al que pertenecen; el `raw_response` conserva el `question_version` y, cuando aplica (p.ej. `Q06_STYLE_FRAGMENT`), el `stimulus_hash` del fragmento-exacto mostrado. Ver §26 sobre inmutabilidad de estímulos.

#### `Q01_LOVED_BOOKS`

**Texto:** “Agrega hasta tres libros que hayas disfrutado mucho.”  
**Tipo:** búsqueda y selección múltiple, opcional.  
**Máximo:** 3 libros.  
**Por cada libro preguntar:** “¿Qué fue lo que más te gustó?”

Opciones:

- `story_progress`
- `characters`
- `writing_style`
- `tension_mystery`
- `ideas`
- `emotional_effect`
- `setting_world`
- `other`

**Uso:** crear evidencia histórica de peso medio. No asumir que todo rasgo del libro fue positivo.

#### `Q02_DISLIKED_BOOK`

**Texto:** “Agrega un libro que no te gustó o que hayas abandonado.”  
**Tipo:** búsqueda de un libro, opcional.  
**Seguimiento:** “¿Qué fue lo que no te funcionó?”

Opciones:

- `slow_without_payoff`
- `characters_no_connection`
- `writing_style`
- `confusing`
- `too_long`
- `wrong_moment`
- `topic_no_interest`
- `other`

**Uso:** evidencia negativa. `wrong_moment` debe tener peso muy bajo.

#### `Q03_PRIORITY_RANKING`

**Texto:** “Ordena las tres cosas que más valoras al leer.”  
**Tipo:** ranking de tres elementos.

Opciones:

- `plot`
- `characters`
- `ideas`
- `atmosphere`
- `style`
- `emotion`

**Normalización:** pesos Borda `[3, 2, 1, 0, 0, 0]`, divididos entre 6.

Ejemplo:

```json
{
  "plot": 0.5,
  "characters": 0.3333,
  "emotion": 0.1667,
  "ideas": 0,
  "atmosphere": 0,
  "style": 0
}
```

Este vector se guarda como `priority_vector`, no como una dimensión común.

#### `Q04_HOOK_NEED`

**Texto:** “¿Qué tan pronto necesitas sentir que algo importante está pasando?”  
**Tipo:** escala 1 a 5.  
**Mapeo:** `hook_need`.

#### `Q05_SLOW_BURN_TOLERANCE`

**Texto:** “Puedo disfrutar una historia lenta aunque tarde en mostrar hacia dónde va.”  
**Tipo:** escala 1 a 5.  
**Mapeo:** `slow_burn_tolerance`.

##### `Q05A_SLOW_BURN_CONDITIONS`

Mostrar si `Q05 >= 2`.

**Texto:** “¿Qué tendría que ofrecerte para que esa lentitud valga la pena?”  
**Tipo:** selección múltiple, máximo 3.

Opciones:

- `strong_characters`
- `tension`
- `atmosphere`
- `beautiful_style`
- `interesting_ideas`
- `clear_progress`

**Uso:** generar `conditional_rules`; no sobrescribir directamente `slow_burn_tolerance`.

#### `Q06_STYLE_FRAGMENT`

**Texto:** “¿Cuál de estas formas de escribir te invitaría más a continuar?”  
**Tipo:** selección única entre tres fragmentos originales del producto.

Los fragmentos deben ser propios, versionados y de longitud similar. No usar texto protegido de novelas.

Fragmentos de referencia para la versión 1:

**A — directo**

> La puerta estaba abierta. Marta dejó las llaves sobre la mesa y recorrió la casa sin encender la luz. En la cocina faltaba una silla. Entonces escuchó el teléfono del piso de arriba.

**B — atmosférico**

> La lluvia había borrado los bordes de la calle y las ventanas devolvían una luz amarilla, cansada. Marta entró en la casa con la sensación de que algo llevaba horas esperándola.

**C — introspectivo**

> Antes de entrar, Marta pensó que una casa también podía guardar rencor. No sabía por qué había vuelto ni por qué, al tocar la puerta, sintió que pedía permiso a alguien que ya no estaba.

La configuración de cada opción debe incluir un vector de evidencia, no lógica hardcodeada en frontend.

Ejemplo:

```json
{
  "option_key": "direct",
  "evidence": [
    { "dimension_key": "style_clarity_preference", "observed_value": 0.9 },
    { "dimension_key": "ornate_prose_tolerance", "observed_value": 0.2 },
    { "dimension_key": "introspection_tolerance", "observed_value": 0.3 }
  ]
}
```

#### `Q07_COMPLEXITY`

Dos escalas independientes:

1. “Puedo disfrutar lenguaje poco común o frases exigentes.”  
   Mapea a `linguistic_complexity_tolerance`.
2. “Puedo disfrutar historias con saltos de tiempo, varias voces o piezas que debo conectar.”  
   Mapea a `structural_complexity_tolerance`.

#### `Q08_ENDING_PREFERENCE`

**Texto:** “¿Cómo prefieres que cierre una historia?”  
**Tipo:** opción única.

| Opción | `open_ending_tolerance` observado |
|---|---:|
| `closed_explained` | `0.10` |
| `resolved_with_interpretation` | `0.40` |
| `open_ambiguous` | `0.85` |
| `no_preference` | no genera evidencia |

#### `Q09_CHARACTER_PREFERENCES`

**Texto:** “¿Qué clase de personajes disfrutas más?”  
**Tipo:** selección múltiple, máximo 3.  
**`is_required`: false**.

Mapeo normativo (`option_key → dimension_key → observed_value → reason_code → base_weight`):

| `option_key` | `dimension_key` | `observed_value` | `reason_code` | `base_weight` |
|---|---|---:|---|---:|
| `competent` | `character_agency_preference` | `0.85` | `q09_character_competent` | `0.60` |
| `psychologically_deep` | `character_depth_need` | `0.90` | `q09_character_psychologically_deep` | `0.60` |
| `morally_ambiguous` | `moral_ambiguity_tolerance` | `0.85` | `q09_character_morally_ambiguous` | `0.60` |
| `easy_to_like` | `character_likability_need` | `0.85` | `q09_character_easy_to_like` | `0.60` |
| `realistic_imperfect` | `character_depth_need` | `0.70` | `q09_character_realistic_imperfect` | `0.60` |
| `strange_unpredictable` | `strangeness_preference` | `0.80` | `q09_character_strange_unpredictable` | `0.60` |
| `characters_not_central` | (dominio 3 marcado reducido) | — | `q09_characters_not_central` | aplica un `domain_weight_adjustment` que reduce el peso del dominio 3 a `0.5 ×` del canon; no asigna valores nulos a las dimensiones. |

Para `characters_not_central`, el `EvidenceFactory` produce una `evidence_adjustment` con `reason_code = q09_characters_not_central` que ajusta el `domain_weight` del dominio 3 en runtime (ver `scoring_weights_spec.md` §4).

#### `Q10_EMOTIONAL_EXPERIENCE`

**Texto:** “¿Qué te gustaría sentir con mayor frecuencia al leer?”  
**Tipo:** selección múltiple, máximo 3.  
**`is_required`: true**.

Mapeo normativo (`option_key → dimension_key → observed_value → reason_code → base_weight`):

| `option_key` | `dimension_key` | `observed_value` | `reason_code` | `base_weight` |
|---|---|---:|---|---:|
| `tension` | `tension_preference` | `0.85` | `q10_emotion_tension` | `0.60` |
| `curiosity` | `strangeness_preference` | `0.60` + tag `mystery` affinity `0.60` | `q10_emotion_curiosity` | `0.60` |
| `fun` | `humor_preference` | `0.85` | `q10_emotion_fun` | `0.60` |
| `comfort` | `comfort_preference` | `0.85` | `q10_emotion_comfort` | `0.60` |
| `sadness` | `sadness_tolerance` | `0.75` + `emotional_intensity_preference` `0.70` | `q10_emotion_sadness` | `0.60` |
| `wonder` | `strangeness_preference` | `0.80` + `worldbuilding_load_tolerance` `0.75` | `q10_emotion_wonder` | `0.60` |
| `discomfort` | `darkness_tolerance` | `0.70` + `emotional_intensity_preference` `0.70` | `q10_emotion_discomfort` | `0.60` |
| `hope` | `hope_preference` | `0.85` | `q10_emotion_hope` | `0.60` |
| `reflection` | `introspection_tolerance` | `0.70` + `conceptual_depth_appreciation` `0.65` | `q10_emotion_reflection` | `0.60` |

`curiosity` y `wonder` generan además tag affinity entry-records en `reader_tag_preferences` con `confidence = 0.40` (peso bajo), `tag_type = genre`.
- `reflection`

Cada opción debe generar evidencia sobre dimensiones emocionales o etiquetas, según configuración.

#### `Q11_GENRES_THEMES`

**Texto:** “Elige algunos tipos de historias o temas.”  
**Tipo:** selector de etiquetas en tres grupos.

- “Me suelen gustar”: máximo 5, afinidad inicial `0.80`.
- “Me dan curiosidad”: máximo 3, afinidad inicial `0.45`.
- “No me interesan por ahora”: opcional, afinidad inicial `-0.40`.

No mostrar contenido sensible explícito en esta pantalla. Usar géneros, ambientaciones y temas generales.

#### `Q12_LENGTH_SERIES`

Campos:

- rango de páginas aceptado;
- preferencia por libro independiente o saga.

Valores de `series_preference`:

- `standalone_only`
- `standalone_preferred`
- `no_preference`
- `series_welcome`

#### `Q13_FORMAT_LANGUAGE`

Campos:

- formatos aceptados: `physical`, `ebook`, `audiobook`;
- idiomas aceptados;
- traducción aceptada: `yes`, `no_preference`, `original_only`.

#### `Q14_DISCOVERY_APPETITE`

**Texto:** “¿Qué tanto quieres que nos alejemos de lo que ya sabes que te gusta?”  
**Tipo:** escala 1 a 5.

| Respuesta | Texto | Valor |
|---:|---|---:|
| 1 | “Quiero una apuesta muy segura.” | `0.00` |
| 2 | “Algo familiar con una diferencia.” | `0.25` |
| 3 | “Equilibrio entre seguridad y descubrimiento.” | `0.50` |
| 4 | “Quiero salir de mi zona habitual.” | `0.75` |
| 5 | “Sorpréndeme por completo.” | `1.00` |

#### Preferencias privadas opcionales

No formar parte del flujo obligatorio. Mostrar como enlace o acordeón:

> “¿Hay algo que prefieras no recibir? Opcional.”

- Campo libre o selector buscable.
- No mostrar una lista gráfica de contenidos sensibles.
- Una interpretación automática debe quedar como `pending_confirmation` hasta que el usuario la confirme.
- Nunca usar esta respuesta para marketing o perfil público.

#### 6.3 Clasificación obligatoria `is_required`

Estas preguntas (`question_definitions.is_required = true`) son necesarias para resolver el estado `ready_to_recommend` del perfil (ver §26.6 y `scoring_weights_spec.md` §10.6):

1. `Q03_PRIORITY_RANKING` (define `priority_vector` mapea `domain_weight` a 1–6).
2. `Q04_HOOK_NEED`.
3. `Q08_ENDING_PREFERENCE`.
4. `Q10_EMOTIONAL_EXPERIENCE`.
5. `Q11_GENRES_THEMES`.
6. `Q12_LENGTH_SERIES`.
7. `Q13_FORMAT_LANGUAGE`.
8. `Q14_DISCOVERY_APPETITE`.

Opcionales (no impiden `ready_to_recommend`): `Q01_LOVED_BOOKS`, `Q02_DISLIKED_BOOK`, `Q05_SLOW_BURN_TOLERANCE`, `Q05A_SLOW_BURN_CONDITIONS`, `Q06_STYLE_FRAGMENT`, `Q07_COMPLEXITY`, `Q09_CHARACTER_PREFERENCES`. Y las preferencias privadas del §6.2. Las opcionales que sí generan evidencia cuando se responden: `Q05A`, `Q06`, `Q07` y `Q09`, con el `base_weight` del catálogo §8.2.

---

## 7. Ramificación del cuestionario

La ramificación debe ser determinista y basada en un banco cerrado.

Ejemplos:

1. Si `Q05_SLOW_BURN_TOLERANCE >= 0.25`, mostrar `Q05A_SLOW_BURN_CONDITIONS`.
2. Si el usuario selecciona `no_preference` en estilo o complejidad, mostrar una comparación adicional versionada.
3. Si los libros favoritos indican una preferencia incompatible con una respuesta directa, mostrar una pregunta de desempate del banco.
4. Nunca mostrar más de tres preguntas adicionales.
5. La IA puede sugerir `next_question_id`; el backend verifica que esté permitido por las reglas de la versión del cuestionario.

---

## 8. Modelo de evidencia

Cada respuesta o interacción genera cero o más registros de evidencia.

### 8.1 Contrato de evidencia

```json
{
  "evidence_id": "ev_01J...",
  "user_id": "usr_01J...",
  "source_type": "questionnaire_answer",
  "source_id": "ans_01J...",
  "book_id": null,
  "dimension_key": "hook_need",
  "observed_value": 0.75,
  "direction": 1,
  "base_weight": 0.6,
  "exposure_factor": 1.0,
  "specificity_factor": 1.0,
  "attribution_factor": 1.0,
  "final_weight": 0.6,
  "reason_code": "direct_scale_answer",
  "raw_payload": {},
  "created_at": "2026-07-30T20:00:00Z"
}
```

### 8.2 Pesos base iniciales

| Fuente | `base_weight` |
|---|---:|
| Respuesta directa del cuestionario | `0.60` |
| Ranking o comparación forzada | `0.80` |
| Elección entre fragmentos | `1.00` |
| Opinión específica sobre libro recordado | `0.90` |
| Libro enviado y terminado con feedback específico | `1.40` |
| Libro enviado y abandonado por desajuste claro | `1.50` |
| Abandono por “no era el momento” | `0.20` |
| Libro no iniciado por falta de tiempo | `0.10` |

Los pesos deben vivir en configuración versionada, no como constantes dispersas.

### 8.3 Factor de exposición

| Progreso | `exposure_factor` |
|---|---:|
| No iniciado | `0.10` |
| Menos de 10% | `0.25` |
| 10–25% | `0.45` |
| 25–50% | `0.70` |
| 50–75% | `0.85` |
| Más de 75% | `0.95` |
| Terminado | `1.00` |

### 8.4 Factor de especificidad

| Evidencia | `specificity_factor` |
|---|---:|
| Solo calificación global | `0.50` |
| Selección de aspectos concretos | `0.80` |
| Explicación clara mapeada a una dimensión | `1.00` |
| Texto ambiguo | no crear evidencia automática; enviar a revisión o pedir aclaración |

### 8.5 Factor de atribución

| Atribución del resultado | `attribution_factor` |
|---|---:|
| Principalmente el libro | `1.00` |
| Combinación libro y momento | `0.60` |
| Principalmente el momento | `0.25` |
| Circunstancia externa | `0.10` |
| No hubo problema | `1.00` para evidencia positiva |

### 8.6 Cálculo del peso final

```text
final_weight =
  base_weight
  × exposure_factor
  × specificity_factor
  × attribution_factor
```

Restricciones:

```text
0 <= final_weight <= 2
```

No utilizar una “confianza de la IA” como multiplicador.

---

## 9. Cálculo del perfil

### 9.1 Estado inicial

Antes de cualquier respuesta:

```json
{
  "dimension_key": "hook_need",
  "value": null,
  "confidence": 0.0,
  "evidence_count": 0,
  "total_evidence_weight": 0.0
}
```

### 9.2 Valor agregado

Para una dimensión con evidencias `i`:

```text
value = Σ(final_weight_i × observed_value_i) / Σ(final_weight_i)
```

Si no existen evidencias válidas:

```text
value = null
confidence = 0
```

### 9.3 Consistencia

Calcular varianza ponderada:

```text
variance = Σ(w_i × (x_i - value)^2) / Σ(w_i)
```

En un rango `0..1`, la varianza máxima práctica es `0.25`. Normalizar:

```text
consistency = clamp(1 - variance / 0.25, 0, 1)
```

- Una sola evidencia produce `consistency = 1`, pero la confianza sigue siendo baja por falta de peso acumulado.
- Evidencias opuestas reducen `consistency`.

### 9.4 Confianza por madurez de evidencia

```text
evidence_maturity = 1 - exp(-total_evidence_weight / 3.0)

confidence_raw = evidence_maturity × (0.4 + 0.6 × consistency)
```

Aplicar límites:

```text
0 <= confidence <= 0.95
```

### 9.5 Caps por tipo de evidencia

| Evidencia disponible | Cap máximo |
|---|---:|
| Solo cuestionario inicial | `0.55` |
| Cuestionario + libros recordados | `0.65` |
| Al menos una entrega con feedback | `0.85` |
| Tres o más entregas con feedback específico | `0.95` |

El objetivo es evitar que un cuestionario inicial parezca más preciso de lo que realmente es.

### 9.6 Ejemplo de primera respuesta

El usuario responde 4/5 en `hook_need`:

```json
{
  "observed_value": 0.75,
  "final_weight": 0.60
}
```

Resultado aproximado:

```json
{
  "value": 0.75,
  "confidence": 0.1813,
  "evidence_count": 1,
  "total_evidence_weight": 0.60
}
```

La confianza no proviene de la IA. Se deriva del peso acumulado y la consistencia.

### 9.7 Contradicciones

No resolver toda contradicción promediando sin contexto.

Ejemplo:

- El usuario declara tolerar historias lentas.
- Abandona dos historias lentas sin progreso.
- Disfruta una historia lenta con tensión psicológica.

Crear una regla condicional:

```json
{
  "rule_key": "slow_burn_requires_tension",
  "if": {
    "book.slow_burn_level": { "gte": 0.65 }
  },
  "then_require": {
    "book.tension_level": { "gte": 0.70 }
  },
  "confidence": 0.72,
  "reason": "Tolera la lentitud cuando existe tensión sostenida."
}
```

Las reglas condicionales deben tener evidencia asociada y versionado.

---

## 10. JSON del perfil lector

```json
{
  "schema_version": "reader-profile/1.0",
  "profile_id": "rp_01J...",
  "user_id": "usr_01J...",
  "profile_version": 3,
  "updated_at": "2026-07-30T20:00:00Z",
  "dimensions": {
    "hook_need": {
      "value": 0.8,
      "confidence": 0.62,
      "evidence_count": 4,
      "total_evidence_weight": 2.9
    },
    "pace_preference": {
      "value": 0.7,
      "confidence": 0.48,
      "evidence_count": 2,
      "total_evidence_weight": 1.4
    },
    "multi_pov_tolerance": {
      "value": null,
      "confidence": 0.0,
      "evidence_count": 0,
      "total_evidence_weight": 0.0
    }
  },
  "priority_vector": {
    "plot": 0.5,
    "characters": 0.3333,
    "emotion": 0.1667,
    "ideas": 0,
    "atmosphere": 0,
    "style": 0
  },
  "tag_preferences": [
    {
      "tag_key": "psychological_thriller",
      "tag_type": "genre",
      "affinity": 0.9,
      "confidence": 0.75
    }
  ],
  "constraints": {
    "preferred_pages": {
      "min": 180,
      "max": 420
    },
    "series_preference": "standalone_preferred",
    "accepted_formats": ["physical", "ebook"],
    "accepted_languages": ["es"],
    "private_exclusions": []
  },
  "positive_triggers": [
    "psychological_tension",
    "clear_narrative_progress",
    "distinct_character_voices"
  ],
  "soft_aversions": [
    "repetitive_internal_monologue",
    "slow_pacing_without_payoff"
  ],
  "conditional_rules": [],
  "evidence_summary": {
    "questionnaire_answers": 13,
    "remembered_books": 2,
    "delivered_books_completed": 1,
    "delivered_books_abandoned": 0
  },
  "overall_confidence": 0.54
}
```

### 10.1 Confianza general

`overall_confidence` no es el promedio simple de todas las dimensiones, porque las desconocidas lo distorsionarían.

Calcular sobre dimensiones relevantes con valor no nulo:

```text
overall_confidence =
  weighted_average(dimension.confidence, domain_importance)
```

Limitar a `0.95`.

---

## 11. Cuestionario de feedback de una entrega

El feedback debe tomar entre 1 y 3 minutos y adaptarse al estado del libro.

### `F01_STARTED`

**Texto:** “¿Llegaste a empezar el libro?”  
Opciones: `yes`, `no`.

#### `F01A_NOT_STARTED_REASON`

Mostrar si `F01 = no`.

Opciones:

- `no_time`
- `wrong_mood`
- `read_something_else`
- `format_or_size`
- `did_not_attract_me`
- `other`

No modificar fuertemente el perfil literario.

### `F02_READING_STATUS`

Mostrar si lo empezó.

Opciones:

- `completed`
- `in_progress`
- `paused`
- `abandoned`

### `F03_PROGRESS`

Opciones visibles y valor almacenado:

| Opción | Porcentaje normalizado |
|---|---:|
| `under_10` | `5` |
| `between_10_25` | `18` |
| `between_25_50` | `38` |
| `between_50_75` | `63` |
| `over_75` | `88` |
| `completed` | `100` |

### `F04_SELECTION_FIT`

**Texto:** “¿Qué tan bien sentiste que este libro fue elegido para ti?”  
Escala 1 a 5.

Esta calificación mide el producto de curaduría, no la calidad objetiva del libro.

### `F05_POSITIVE_ASPECTS`

**Texto:** “¿Qué fue lo que mejor funcionó?”  
Selección múltiple, máximo 3.

Mapeo normativo (`option_key → dimension_key → observed_value → reason_code → base_weight`). Las evidencias resultantes son **positivas** con `direction = +1`:

| `option_key` | `dimension_key` (`observed_value`, `reason_code`) | `base_weight` |
|---|---|---:|
| `story_progress` | `narrative_payoff_requirement` up (`0.80`, `f05_story_progress_pos`) | `1.40` |
| `tension_curiosity` | `tension_preference` (`0.85`, `f05_tension_pos`), `strangeness_preference` (`0.70`, `f05_curiosity_pos`) | `1.40` |
| `characters` | `character_depth_need` pos (`0.85`, `f05_characters_pos`), `character_agency_preference` (`0.75`, `f05_agency_pos`) | `1.40` |
| `character_relationships` | `relationship_focus_preference` (`0.85`, `f05_relationships_pos`) | `1.40` |
| `writing_style` | `style_clarity_preference` (`0.85`, `f05_style_clarity_pos`), `dialogue_preference` (`0.75` si correspóndase en F09) — directo sin F09: sólo `style_clarity_preference` | `1.40` |
| `atmosphere` | `descriptive_density_preference` (`0.80`, `f05_atmosphere_pos`), tag `atmospheric_*` affinity boost `+0.20` | `1.40` |
| `ideas_reflection` | `conceptual_depth_appreciation` (`0.85`, `f05_ideas_pos`), `introspection_tolerance` (`0.75`, `f05_reflection_pos`) | `1.40` |
| `emotional_effect` | `emotional_intensity_preference` (`0.85`, `f05_emotional_effect_pos`) | `1.40` |
| `setting_world` | `worldbuilding_load_tolerance` (`0.80`, `f05_setting_pos`), tag `setting_*` affinity boost `+0.15` | `1.40` |
| `length` | ajuste `length_fit` evidencia indirecta; no genera evidencia de dimensión, incrementa `total_evidence_weight` del `length_fit` agregado | `0.80` |
| `nothing_in_particular` | no genera evidencia; `reason_code = f05_no_specific_positive` y `dimension_key = null` (registro en `reading_feedback_aspects` sin `reader_evidence`) | `0.0` |
| `other` | texto libre de F09 → procesado por `AiEvidenceProposerPort`; no genera evidencia automática sin interpretación validada | `0.0` |

`exposure_factor` se deriva de `F03_PROGRESS` (§8.3); `attribution_factor` de `F07` (§8.5); `specificity_factor` se fija en `0.80` (selección de aspectos concretos, §8.4).

### `F06_NEGATIVE_ASPECTS`

Mostrar cuando:

- `F02 = abandoned`, o
- `F04 <= 3`, o
- el usuario indique que algo no funcionó.

Mapeo normativo (evidencias **negativas** con `direction = -1`, observe `observed_value` indicando valor bajo, también persistido en `raw_payload` como el valor "normal" que rompió):

| `option_key` | `dimension_key` (`observed_value`, `reason_code`) | `base_weight` |
|---|---|---:|
| `slow_without_payoff` | `slow_burn_tolerance` (`0.20`, `f06_slow_no_payoff`), `narrative_payoff_requirement` (`0.85`, `f06_payoff_required`) | `1.50` |
| `too_fast_superficial` | `event_density_preference` (`0.60`, downgrade), `character_depth_need` (`0.85`, `f06_too_fast_superficial_neg`) | `1.50` |
| `confusing` | `linguistic_complexity_tolerance` (`0.25`, `f06_confusing`), `structural_complexity_tolerance` (`0.25`, `f06_confusing_structural`) | `1.50` |
| `too_many_voices_names_jumps` | `multi_pov_tolerance` (`0.20`, `f06_too_many_pov`), `cast_size_tolerance` (`0.20`, `f06_cast_size`) | `1.50` |
| `characters_no_connection` | `character_likability_need` (`0.85`, `f06_no_connection`), `relationship_focus_preference` (`0.85`, `f06_no_relationships`) | `1.50` |
| `characters_too_similar` | `voice_distinctiveness_need` (`0.85`, `f06_too_similar_voices`) | `1.50` |
| `style_too_simple` | `style_clarity_preference` (`0.25`, `f06_style_too_simple`), `ornate_prose_tolerance` (`0.75`, `f06_needs_ornate`) | `1.50` |
| `style_too_ornate` | `style_clarity_preference` (`0.85`, `f06_style_too_ornate`), `ornate_prose_tolerance` (`0.25`, `f06_too_ornate_neg`) | `1.50` |
| `too_much_introspection` | `introspection_tolerance` (`0.20`, `f06_too_much_introspection`) | `1.50` |
| `repetitive` | `repetition_tolerance` (`0.20`, `f06_repetitive`) | `1.50` |
| `too_demanding` | `linguistic_complexity_tolerance` (`0.20`, `f06_too_demanding_ling`), `structural_complexity_tolerance` (`0.20`, `f06_too_demanding_struct`), `conceptual_density_tolerance` (`0.20`, `f06_too_demanding_conceptual`) | `1.50` |
| `topic_no_interest` | tag affinity adjustment `-0.30` sobre los `tag_key` del tema implícito en `topic_no_interest` si se identifica (F09 mete), sino registro en `reading_feedback_aspects` sin `reader_evidence` | `0.80` |
| `length_problem` | ajusta `length_fit` evidencia indirecta; no genera dimensión | `0.80` |
| `ending_unsatisfying` | `open_ending_tolerance` (`0.10`, `f06_ending_unsatisfying_big`) o si `tolerance` al usuario era alta y el final cerró mal, la `confidence` se reduce sin cambiar el valor con motivo en `reason_text`; mejor persistir así: `open_ending_tolerance` observed `0.10`, `reason_code=f06_ending_unsatisfying` | `1.50` |
| `nothing_important` | `narrative_payoff_requirement` (`0.85`, `f06_nothing_important`) | `1.50` |
| `other` | texto libre F09 → IA validar | `0.0` |

`attribution_factor` se deriva de `F07`; `specificity_factor = 0.80`; `exposure_factor` de `F03`. El `direction = -1`.

### `F07_OUTCOME_ATTRIBUTION`

**Texto:** “¿Crees que el problema fue el libro o el momento?”

Opciones:

- `mostly_book`
- `mixed`
- `mostly_timing`
- `external_circumstance`
- `no_problem`

Mapear al `attribution_factor` definido en la sección 8.5.

### `F08_NEXT_DIRECTION`

**Texto:** “¿Qué quieres para tu siguiente selección?”

Opciones:

- `very_similar`
- `similar_with_changes`
- `clearly_different`
- `fresh_surprise`

Si selecciona `similar_with_changes`, preguntar:

- aspectos a conservar;
- aspectos a cambiar.

### `F09_FREE_TEXT`

**Texto:** “Cuéntanos con tus palabras qué te hizo continuar o qué te hizo perder el interés. Opcional.”

La IA puede mapear este texto a dimensiones existentes, pero no debe crear una evidencia automática si el texto es ambiguo.

### Métrica comercial opcional

Separada del perfil:

> “¿Te gustaría recibir otra selección?”

Valores: `yes`, `maybe`, `no`.

No utilizar esta respuesta como señal literaria.

---

## 12. JSON del feedback

```json
{
  "feedback_version": "1.0",
  "user_id": "usr_01J...",
  "book_id": "book_01J...",
  "recommendation_id": "rec_01J...",
  "reading_status": "abandoned",
  "started": true,
  "completion_percentage": 38,
  "selection_fit_rating": 3,
  "positive_aspects": [
    "tension_curiosity",
    "atmosphere"
  ],
  "negative_aspects": [
    "slow_without_payoff",
    "repetitive"
  ],
  "outcome_attribution": "mostly_book",
  "next_direction": {
    "preference": "similar_with_changes",
    "keep": ["psychological_tension"],
    "change": ["pace", "repetition"]
  },
  "free_text": "Me interesaba saber qué ocurriría, pero sentí que repetía demasiado las mismas ideas.",
  "submitted_at": "2026-08-28T20:15:00Z"
}
```

---

## 13. Persistencia relacional

### 13.1 `dimension_definitions`

| Columna | Tipo | Restricciones |
|---|---|---|
| `key` | `varchar(100)` | PK |
| `domain_key` | `varchar(100)` | NOT NULL |
| `dimension_kind` | enum | NOT NULL |
| `book_feature_key` | `varchar(100)` | nullable |
| `matching_operator` | enum | NOT NULL |
| `lower_label` | `text` | NOT NULL |
| `upper_label` | `text` | NOT NULL |
| `schema_version` | `varchar(30)` | NOT NULL |
| `is_active` | boolean | default true |
| `created_at` | timestamptz | NOT NULL |

### 13.2 `question_definitions`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `question_key` | varchar NOT NULL |
| `version` | integer NOT NULL |
| `questionnaire_version` | varchar NOT NULL |
| `text_es_mx` | text |
| `response_type` | enum |
| `is_required` | boolean |
| `display_order` | integer |
| `branching_rules_json` | JSONB |
| `validation_json` | JSONB |
| `is_active` | boolean |
| `created_at` | timestamptz |

Restricciones:

```sql
UNIQUE (question_key, version);    -- una misma clave puede tener varias versiones publicadas
UNIQUE (question_key, questionnaire_version);
```

El FK de `question_answers` es compuesto: `(question_key, question_version)`. Permite conservar versiones históricas de cada pregunta (cambios de texto, estímulos, mapeos) sin sobreescribir.

### 13.3 `question_option_mappings`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `question_id` | UUID FK |
| `option_key` | varchar |
| `label_es_mx` | text |
| `evidence_mappings_json` | JSONB |
| `sort_order` | integer |
| `is_active` | boolean |

Restricción única: `(question_id, option_key)`.

### 13.4 `questionnaire_sessions`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `user_id` | UUID FK |
| `questionnaire_version` | varchar |
| `status` | `started`, `completed`, `abandoned` |
| `started_at` | timestamptz |
| `completed_at` | timestamptz nullable |
| `metadata_json` | JSONB |

### 13.5 `question_answers`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `session_id` | UUID FK |
| `user_id` | UUID FK |
| `question_key` | varchar |
| `question_version` | integer |
| `questionnaire_version` | varchar | (redundante, pero útil para queries; debe coincidir con la sesión)
| `stimulus_hash` | varchar nullable | Hash del fragmento-estímulo exacto mostrado (p.ej. Q06)
| `raw_response` | JSONB |
| `normalized_response` | JSONB |
| `answered_at` | timestamptz |

Nunca eliminar `raw_response` después de normalizar.

`questionnaire_sessions` se fija a un `questionnaire_version` al crearse (§26.5). Una sesión existente continúa en su versión aunque se publique otra. Las respuestas parciales se conservan; el perfil no queda `ready_to_recommend` hasta completar todas las preguntas `is_required` de esa versión (§26.6).

### 13.6 `reader_profiles`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `user_id` | UUID UNIQUE FK |
| `schema_version` | varchar |
| `current_version` | integer | (locking optimista: cualquier UPDATE (`UPDATE WHERE id = ? AND current_version = ?`) debe verificar y bumpar `current_version`; conflict → `409`)
| `overall_confidence` | numeric(5,4) | (legacy; renombrado a `overall_confidence_legacy` en `scoring_weights_spec.md` §10.5. Se elimina en `profiles-schema/2.0`)
| `global_profile_coverage` | numeric(5,4) | diagnóstica, sobre las 43 claves activas (`scoring_weights_spec.md` §10.1)
| `onboarding_core_coverage` | numeric(5,4) | diagnóstica, sobre 12 `onboarding_core_dimensions` (`scoring_weights_spec.md` §10.2)
| `evidence_maturity` | numeric(5,4) | (`scoring_weights_spec.md` §10.3)
| `ready_to_recommend` | boolean default false | true cuando se cumplen preguntas requeridas, sesion completada, minimum signal set y constraints operativas (ver §26.6)
| `summary` | text nullable |
| `snapshot_json` | JSONB | incluye `evidence_set_hash`, `calculation_version`, `classifier_version`, `prompt_version`
| `created_at` | timestamptz |
| `updated_at` | timestamptz |
| `optimistic_lock_version` | integer NOT NULL default 0 |

### 13.7 `reader_profile_dimensions`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `profile_id` | UUID FK |
| `dimension_key` | varchar FK |
| `value` | numeric(5,4) nullable |
| `confidence` | numeric(5,4) |
| `evidence_count` | integer |
| `total_evidence_weight` | numeric(8,4) |
| `last_evidence_at` | timestamptz nullable |
| `updated_at` | timestamptz |

Restricciones:

```sql
CHECK (value IS NULL OR value BETWEEN 0 AND 1);
CHECK (confidence BETWEEN 0 AND 0.95);
CHECK (total_evidence_weight >= 0);
UNIQUE (profile_id, dimension_key);
```

### 13.8 `reader_profile_versions`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `profile_id` | UUID FK |
| `version` | integer |
| `snapshot_json` | JSONB |
| `change_reason` | varchar |
| `source_id` | UUID nullable |
| `created_at` | timestamptz |

Restricción única: `(profile_id, version)`.

### 13.9 `reader_evidence`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `user_id` | UUID FK |
| `profile_id` | UUID FK |
| `book_id` | UUID nullable |
| `source_type` | enum |
| `source_id` | UUID |
| `dimension_key` | varchar FK |
| `observed_value` | numeric(5,4) |
| `direction` | numeric(5,4) | `+1` evidencia a favor del valor observado; `-1` evidencia en contra. Para tags con `affinity < 0` va `-1`; en evidencias numéricas siempre `+1`. No entra en `final_weight`; sí en reglas condicionales y agregación Bayesiana futura. |
| `base_weight` | numeric(5,4) |
| `exposure_factor` | numeric(5,4) |
| `specificity_factor` | numeric(5,4) |
| `attribution_factor` | numeric(5,4) |
| `final_weight` | numeric(5,4) |
| `reason_code` | varchar |
| `reason_text` | text nullable |
| `raw_payload` | JSONB |
| `evidence_fingerprint` | varchar(64) NOT NULL | hash determinista de `(source_id, dimension_key, reason_code, observed_value, raw_payload)` — ver §26.4
| `status` | enum NOT NULL default `active` | `active`, `superseded`, `rejected`, `deactivated` |
| `superseded_by` | UUID nullable FK (a `reader_evidence.id`) | nueva evidencia que reemplaza ésta |
| `deactivated_at` | timestamptz nullable | timestamp de desactivación (sin borrar fila) |
| `created_at` | timestamptz |

> **Eliminado en 1.1.1**: `evidence_set_hash` como columna de `reader_evidence`. El hash del conjunto vive únicamente en `reader_profile_versions.snapshot_json.evidence_set_hash` y en `reader_profiles.snapshot_json.evidence_set_hash` (ver §26.2 y §26.3). Una evidencia individual pertenece a cero o más snapshots; la pertenencia se reconstruye con `profile_version_evidence` (§13.15).

Restricciones:

```sql
CHECK (observed_value BETWEEN 0 AND 1);
CHECK (direction BETWEEN -1 AND 1);
CHECK (base_weight BETWEEN 0 AND 2);
CHECK (exposure_factor BETWEEN 0 AND 1);
CHECK (specificity_factor BETWEEN 0 AND 1);
CHECK (attribution_factor BETWEEN 0 AND 1);
CHECK (final_weight BETWEEN 0 AND 2);
CHECK (status IN ('active','superseded','rejected','deactivated'));
UNIQUE (evidence_fingerprint);    -- idempotencia: no duplicar la misma evidencia
INDEX (user_id, status);
INDEX (profile_id, status);
```
```

`evidence_fingerprint` evita crear dos evidencias idénticas para la misma fuente (ver §18). El constraint UNIQUE reemplaza la regla "no crear dos evidencias idénticas" informal previa.

### 13.10 `reader_profile_rules`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `profile_id` | UUID FK |
| `rule_key` | varchar |
| `condition_json` | JSONB |
| `effect_json` | JSONB |
| `confidence` | numeric(5,4) |
| `evidence_count` | integer |
| `reason` | text |
| `status` | `active`, `superseded`, `rejected` |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### 13.11 `reader_tag_preferences`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `profile_id` | UUID FK |
| `tag_key` | varchar |
| `tag_type` | varchar |
| `affinity` | numeric(5,4) |
| `confidence` | numeric(5,4) |
| `evidence_count` | integer |
| `updated_at` | timestamptz |

Restricción: `affinity BETWEEN -1 AND 1`.

### 13.12 `reading_requests`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `user_id` | UUID FK |
| `profile_version` | integer |
| `primary_goal` | varchar |
| `secondary_goals` | JSONB | array de strings; metastas a `goal_fit_combined` (`scoring_weights_spec.md` §5.4.4) |
| `desired_emotions` | JSONB |
| `available_energy` | numeric(5,4) nullable | 0..1; modula `effort_fit` (`scoring_weights_spec.md` §5.4.6). Null → `effort_fit = null`, redistribución interna. |
| `reading_time_minutes_per_week` | integer nullable |
| `requested_discovery_level` | numeric(5,4) nullable | si null, el scoring usa `reader.discovery_appetite` directo (`scoring_weights_spec.md` §5.5) |
| `preferred_max_pages` | integer nullable |
| `preferred_max_minutes` | integer nullable | new en 1.1.1: para `length_fit` cuando formato es audiobook |
| `accepted_formats` | JSONB |
| `budget_amount` | numeric(10,2) nullable | new en 1.1.1 |
| `budget_currency` | char(3) nullable | ISO 4217 |
| `delivery_region` | varchar(2) nullable | new en 1.1.1: ISO 3166-1 alpha-2 |
| `allow_used_books` | boolean default false | new en 1.1.1; true → permite `availability_status IN ('out_of_print','discontinued')` |
| `series_membership_preference` | enum nullable | `standalone_only`, `standalone_preferred`, `no_preference`, `first_in_series_only`, `series_welcome_in_order`. Filtro de saga `books.series_id`. |
| `special_note` | text nullable |
| `created_at` | timestamptz |

### 13.13 Libros

Tablas mínimas:

- `books` (con `series_id`, `series_position`, `series_membership`)
- `authors` + `book_authors` (reemplaza `books.author_ids UUID[]`)
- `series`
- `book_features`
- `book_tags`
- `book_editions`
- `book_classification_sources`
- `book_classification_audit` (ver `book_taxonomy_spec.md` §10.4)
- `tag_identity` + `tag_versions` (ver `tag_taxonomy_v1.md` §11; reemplazan a `tag_definitions`)
- `tag_taxonomy_audit` (ver `tag_taxonomy_v1.md` §12)

`books` y `authors`/`book_authors`/`series` definidos en **`book_taxonomy_spec.md`** §12.1, §12.1a, §12.1b, §12.1c. `book_features` debe usar las mismas claves canónicas de `book_feature_key` y almacenar `value`, `confidence`, `source_support_json`, `classifier_version`, `review_status`, `classification_identity`, `is_scoring_aux`, `optimistic_lock_version` (esquema completo en **`book_taxonomy_spec.md`** §12.2). `book_editions` incluye `language` (BCP-47), `format`, `isbn_13`, `isbn_10`, `pages`, `audio_minutes`, `price`, `currency`, `availability_status`, `availability_regions`, `edition_overrides_json`, `optimistic_lock_version` (esquema completo en **`book_taxonomy_spec.md`** §13). El **idioma se aplica por edición**, no por obra: el filtro de idioma (§14.1) consulta el `language` de la `book_edition` candidata, no `books.original_language`. Las features dependientes de edición (`linguistic_complexity`, `style_clarity`, `pages`, `audio_minutes`) se resuelven vía `edition_overrides_json`.

### 13.14 Recomendaciones y feedback

Tablas mínimas:

- `recommendations`
- `recommendation_candidates`
- `recommendation_selections` (ciclo de vida — ver §17.1)
- `reading_feedback`
- `reading_feedback_aspects`
- `curator_action_audit` (ver §26.10)

`recommendation_candidates` debe guardar todos los candidatos evaluados, no solo el ganador. El esquema completo de componentes de score y sus columnas (`numeric_fit_score`, `coverage_ratio`, `tag_fit_score`, sub-scores de contexto incluyendo `context_effort_fit`, `discovery_fit_score`, `scoring_minimum_confidence_factor`, `risk_penalty_breakdown_json`, `weight_distribution_json`, `evaluation_meta_json`) se define en **`scoring_weights_spec.md`** §8 (v1.1).

> **Eliminados en 1.1.1**: `numeric_fit_score_final` (alias de `numeric_fit_score`), `coverage_adjustment` (eliminado).

Campos importantes:

- `candidate_score`
- `numeric_fit_score`
- `tag_fit_score`
- `context_fit_score`
- `context_length_fit`, `context_reading_time_fit`, `context_goal_fit`, `context_emotion_fit`, `context_effort_fit`
- `discovery_fit_score`
- `risk_penalty`
- `risk_penalty_breakdown_json`
- `coverage_ratio` (diagnóstica)
- `scoring_minimum_confidence_factor`
- `recommendation_evidence_coverage`

### 13.15 `profile_version_evidence` (new en 1.1.1)

Tabla **inmutable** para reconstruir exactamente qué evidencias activas participaron en cada snapshot de perfil:

| Columna | Tipo |
|---|---|
| `profile_version_id` | UUID FK a `reader_profile_versions.id` |
| `evidence_id` | UUID FK a `reader_evidence.id` |
| `included_at` | timestamptz NOT NULL |

PK compuesta: `(profile_version_id, evidence_id)`. Append-only. Nunca DELETE ni UPDATE.

Reglas:

- Al crear un `reader_profile_versions`: insertar una fila por cada `evidence_id` activo considerado en `evidence_set_hash`.
- Para reconstruir el historial: `SELECT evidence_id FROM profile_version_evidence WHERE profile_version_id = ?`.
- `evidence_set_hash` = SHA-256 ordenado de los `evidence_fingerprint` de esas evidencias; debe coincidir con el hash del snapshot (ver §26.2/§26.3).
- Esta tabla elimina la ambigüedad de mantener `evidence_set_hash` en cada fila de `reader_evidence` (que repetía el hash equivocadamente).
- `recommendation_evidence_coverage`
- `rank_position`
- `selected_by_curator`
- `curator_reason`

Esto permitirá aprender más adelante tanto de los libros enviados como de los candidatos descartados.

---

## 14. Scoring determinista del MVP

El scoring no reemplaza la curaduría humana. Solo ordena candidatos.

> **Nota 1.1.1:** la definición completa de `numeric_fit_score` (con `effective_weight`), `tag_fit_score`, `context_fit_score` (incluyendo `effort_fit`), `discovery_fit_score`, `risk_penalty`, `domain_weight`, mapeo `priority_vector` (incluyendo `ideas → conceptual_depth_appreciation`), tratamiento de `null` (reader, book y componente), confianza mínima, reglas bloqueantes vs penalizadoras, normalización/redondeo/orden canónico, persistencia de cada componente, ejemplos con números y pruebas de determinismo se define en **`scoring_weights_spec.md`** v1.1. Esta sección describe el flujo a alto nivel; cualquier conflicto se resuelve a favor de `scoring_weights_spec.md`.

### 14.1 Fase 1: filtros duros

Excluir libros que incumplan:

- formato no aceptado;
- idioma no aceptado (se consulta `book_editions.language`, no `books.original_language`);
- longitud máxima absoluta (en `pages` o `audio_minutes` según el formato de la edición considerada);
- saga no aceptada:
  - `series_membership_preference = standalone_only` ⇒ sólo `series_membership = standalone` o `series_position IS NULL`.
  - `standalone_preferred` ⇒ incluye standalone y, con leve penalización, el primer volumen (`series_position = 1`).
  - `first_in_series_only` ⇒ `series_position = 1` o `series_membership = standalone`.
  - `series_welcome_in_order` ⇒ `series_position` válido, sin candidatos posteriores a la última lectura del usuario en esa saga (`series_id`), esa preferencia puede validar el orden.
  - `no_preference` ⇒ sin restricción de saga.
- falta de disponibilidad:
  - `availability_status IN ('out_of_print','discontinued')` ⇒ sólo si `reading_request.allow_used_books = true`.
  - `availability_regions` debe incluir `reading_request.delivery_region`.
- exclusión privada confirmada (`reader_profile_constraints.private_exclusions`);
- presupuesto:
  - `book_editions.price > reading_request.budget_amount` (si ambos no son null) y moneda `book_editions.currency = reading_request.budget_currency`. Si `budget_amount` es null, no filtra.
- elegibilidad de features core (`book_taxonomy_spec.md` §9.2): falta de `scoring_required_minimum` ⇒ `needs_classification`.

### 14.2 Fase 2: compatibilidad numérica

La fórmula canónica está en **`scoring_weights_spec.md`** §5.1 con `effective_weight = dimension_weight × reader_confidence × book_confidence`. Aquí sólo se reportan los operadores de `compatible(dim)` por `matching_operator`:

Para dimensiones tipo `target`:

```text
compatible = 1 - abs(reader_value - book_value)
```

Para `minimum_required`:

```text
compatibility = 1                           if book_value >= reader_value
compatibility = 1 - (reader_value-book_value) otherwise
```

Para `maximum_tolerated`:

```text
compatibility = 1                           if book_value <= reader_value
compatibility = 1 - (book_value-reader_value) otherwise
```

Aplicar `clamp(compatible, 0, 1)`.

No usar dimensiones con `reader_value = null` o confianza menor a `0.15`. No usar features con `book_value = null` o `book_confidence < 0.20`. `effective_weight` se anula para esas dimensiones elegibles (ver `scoring_weights_spec.md` §5.1).

### 14.3 Afinidad por etiquetas

Fórmula canónica en **`scoring_weights_spec.md`** §5.3:

```text
signed  = Σ_t user_affinity[t] × book_tag_strength[t] × user_confidence[t] / Σ_t |user_affinity[t]|
tag_fit_score = (signed + 1) / 2
```

`book_tag_strength ∈ [0,1]`, `user_affinity ∈ [-1,1]`. Match por `tag_type`. Las etiquetas `deprecated` se sustituyen por `replacement_tag_key` (`tag_taxonomy_v1.md` §8). Las exclusiones confirmadas (`private_exclusions`) se resuelven en filtros duros, no mediante score negativo.

### 14.4 Contexto actual

Cruzar `reading_request` con:

- longitud;
- exigencia cognitiva;
- emoción;
- ritmo;
- formato;
- nivel de descubrimiento.

### 14.5 Reglas condicionales

Evaluar reglas después del score base. Una regla incumplida puede:

- aplicar penalización (`effect = penalty`);
- bloquear candidato (`effect = block`);
- exigir revisión humana (`effect = review`).

El JSON Schema cerrado de `conditional_rules` y los tres `effect_kind` se define en el §26.13.

### 14.6 Fórmula inicial sugerida

```text
final_score =
  0.50 × numeric_fit_score
  + 0.20 × tag_fit_score
  + 0.20 × context_fit_score
  + 0.10 × discovery_fit_score
  - risk_penalty
```

Todos los componentes deben quedar persistidos para auditoría. La definición canónica, redistribución de pesos ante componentes `null` y aritmética decimal exacta están en **`scoring_weights_spec.md`** §7 y §8. En 1.1.1, `numeric_fit_score` ingresa directo (no se multiplica por `coverage_adjustment` — eliminado). Los pesos redistribuidos se persisten en `weight_distribution_json`.

---

## 15. Responsabilidades del agente de IA

### 15.1 Permitido

La IA puede:

1. Interpretar texto libre dentro de una taxonomía cerrada.
2. Convertir respuestas a JSON válido.
3. Proponer evidencias asociadas a claves existentes.
4. Resumir por qué funcionó o falló una lectura.
5. Clasificar un libro usando sinopsis, muestra, metadatos y reseñas.
6. Detectar contradicciones potenciales.
7. Proponer una regla condicional.
8. Sugerir una pregunta adicional del banco aprobado.
9. Generar una explicación para el curador.

### 15.2 Prohibido

La IA no puede:

1. Crear nuevas dimensiones sin migración y aprobación.
2. Definir pesos de evidencia.
3. Calcular la confianza final.
4. Modificar directamente el perfil persistido.
5. Convertir texto ambiguo en una exclusión dura sin confirmación.
6. Inventar libros, ediciones o metadatos.
7. Tomar por sí sola la decisión final del libro enviado durante el MVP.
8. Usar edad, género u otros rasgos demográficos como drivers principales.
9. exponer preferencias privadas en resúmenes públicos.

### 15.3 Contrato de salida para interpretación de texto

```json
{
  "schema_version": "ai-evidence-proposal/1.0",
  "source_id": "feedback_01J...",
  "proposed_evidence": [
    {
      "dimension_key": "repetition_tolerance",
      "observed_value": 0.1,
      "reason_code": "explicit_negative_feedback",
      "supporting_excerpt": "sentí que repetía demasiado las mismas ideas"
    }
  ],
  "proposed_tags": [],
  "proposed_rules": [],
  "needs_human_review": false,
  "ambiguities": []
}
```

El backend debe:

- validar el JSON Schema;
- rechazar claves desconocidas;
- calcular pesos;
- persistir propuesta y resultado;
- ejecutar recomputación determinista.

### 15.4 Configuración recomendada

- Temperatura: `0` a `0.2`.
- Salida estructurada obligatoria.
- Reintentos por JSON inválido.
- Timeout y circuit breaker (implementación en runtime, no dependiente de Redis/BullMQ en V1).
- Prompt versionado.
- Guardar `model`, `prompt_version` y `raw_output` para auditoría.
- No utilizar el número de “confianza” autodeclarado por el modelo como confianza del perfil.
- Toda interacción pasa por `AiEvidenceProposerPort` (§26.12); cualquier proveedor concreto vive en `infrastructure/ai` y es reemplazable sin tocar el dominio.

---

## 16. Servicios y operaciones sugeridas

### `ProfileAggregationService`

Responsabilidades:

- cargar evidencias activas;
- calcular valores y confianza;
- aplicar caps;
- generar snapshot;
- guardar nueva versión;
- no interpretar texto.

### `EvidenceFactory`

Responsabilidades:

- convertir respuestas normalizadas en evidencias;
- aplicar configuración de pesos;
- calcular factores;
- evitar duplicados por `source_id + dimension_key + reason_code`.

### `QuestionnaireEngine`

Responsabilidades:

- servir preguntas por versión;
- validar respuestas;
- ejecutar branching determinista;
- limitar preguntas adicionales;
- conservar texto y versión original.

### `BookClassificationService`

Responsabilidades:

- almacenar features y tags del libro;
- mantener evidencia por fuente;
- permitir revisión humana;
- versionar cambios.

### `RecommendationScoringService`

Responsabilidades:

- filtrar candidatos;
- calcular componentes de score;
- evaluar reglas;
- persistir ranking completo;
- explicar score al curador.

La **definición canónica** de la fórmula, componentes, redistribución de pesos y persistencia está en `scoring_weights_spec.md` §5, §7 y §8.

### `FeedbackProcessingService`

Responsabilidades:

- validar feedback;
- crear evidencias explícitas;
- solicitar interpretación de texto libre si existe (a través de `AiEvidenceProposerPort`);
- recomputar perfil (idempotencia via `evidence_set_hash`, ver §26.3);
- crear snapshot de versión (solo si cambia el conjunto de evidencia).

---

## 17. Endpoints mínimos

```text
POST   /v1/questionnaire-sessions                       # crea sesión fijada a questionnaire_version vigente (§26.5)
GET    /v1/questionnaire-sessions/{id}/next-question
POST   /v1/questionnaire-sessions/{id}/answers
POST   /v1/questionnaire-sessions/{id}/complete
GET    /v1/users/{userId}/reader-profile
POST   /v1/users/{userId}/reading-requests
POST   /v1/reading-requests/{id}/recommendations/score
POST   /v1/recommendations/{id}/select                  # crea recommendation_selection con status=selected
POST   /v1/recommendations/{id}/deselect                # revierte selección (§17.1) — sólo antes de envío
POST   /v1/recommendations/{id}/reselect                # reemplaza el libro seleccionado por otro candidato del mismo ranking
POST   /v1/recommendations/{id}/send                    # transición selected -> sent (lógica de negocio)
POST   /v1/recommendations/{id}/feedback                # feedback del envío
POST   /v1/users/{userId}/reader-profile/recompute      # idempotente (§18, §26.3)
GET    /v1/users/{userId}/reader-profile/versions
GET    /v1/users/{userId}/reader-profile/coverage        # global_profile_coverage, onboarding_core_coverage, evidence_maturity
```

Operaciones de recomputación deben ser idempotentes.

### 17.1 Ciclo de vida de recomendaciones y selecciones

`recommendations.status` enum:

```text
draft -> scored -> selection_pending -> selected -> sent -> feedback_received -> closed
                     \-> expired            \-> deselected (vuelve a selection_pending)
```

- `draft`: existe la request pero todavía no se corre el scoring.
- `scored`: hay candidatos persistidos en `recommendation_candidates` con `review_status = approved`.
- `selection_pending`: el curador aún no elige un libro.
- `selected`: se eligió un `recommendation_candidate`; crea fila en `recommendation_selections` con `status = selected`. Sólo una selección activa por `recommendation` (UNIQUE parcial sobre `(recommendation_id) WHERE status IN ('selected')`).
- `deselected`: el curador revierte antes del envío; la `recommendation` vuelve a `selection_pending` y la selección previa queda con `status = deselected` para auditoría.
- `sent`: el libro fue despachado al usuario (transición controlada por reglas de negocio).
- `feedback_received`: llegó al menos un feedback (ver §11).
- `closed`: feedback completo + perfil recalculado + versión nueva.

`recommendation_selections` tabla:

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `recommendation_id` | UUID FK |
| `candidate_id` | UUID FK (`recommendation_candidates.id`) |
| `status` | enum (`selected`, `deselected`, `sent`, `canceled`) |
| `actor_id` | UUID |
| `actor_role` | enum (`curator`, `admin`) |
| `reason` | text nullable |
| `optimistic_lock_version` | integer |
| `selected_at` | timestamptz |
| `deselected_at` | timestamptz nullable |
| `sent_at` | timestamptz nullable |

Cualquier transición escribe en `curator_action_audit` (§26.10). El rollback siempre es explícito (registrado), nunca destructivo.

---

## 18. Idempotencia y trazabilidad

1. Cada respuesta debe tener un `idempotency_key` opcional de cliente.
2. No crear dos evidencias idénticas para la misma fuente: se garantiza con `evidence_fingerprint` único en `reader_evidence` (§13.9, §26.4).
3. Una recomputación con el mismo conjunto de evidencia debe producir el mismo perfil.
4. Guardar `calculation_version` en cada snapshot, además de `evidence_set_hash`, `classifier_version` y `prompt_version` (§26.2).
5. Cambiar fórmulas requiere nueva `calculation_version` y, si se desea, recomputación histórica controlada.
6. Nunca mutar una versión histórica.
7. **Recompute sin cambios**: si la recomputación produce el mismo `evidence_set_hash` que el snapshot vigente, el backend **devuelve el snapshot existente y no crea una nueva `profile_version`** (§26.3).
8. **Locking optimista**: toda mutación de `reader_profiles` o `reader_profile_dimensions` usa `current_version` / `optimistic_lock_version` (§26.1).

---

## 19. Pruebas de aceptación

### Estado inicial

- Dado un usuario sin respuestas, todas las dimensiones deben tener `value = null` y `confidence = 0`.

### Primera respuesta

- Dada una respuesta 4/5 en `hook_need`, el valor debe ser `0.75`.
- La confianza debe ser aproximadamente `0.1813` con peso `0.60` y cálculo versión 1.

### Evidencia consistente

- Varias evidencias cercanas deben aumentar la confianza.
- La confianza no debe superar `0.55` cuando todas las fuentes provienen del cuestionario inicial.

### Evidencia contradictoria

- Evidencias opuestas deben reducir `consistency`.
- Una contradicción contextual no debe eliminar el historial previo.
- Debe ser posible registrar una regla condicional.

### Abandono externo

- Un libro no iniciado por falta de tiempo no debe modificar significativamente dimensiones literarias.

### Feedback específico

- Un abandono al 50% por “estilo repetitivo” debe generar evidencia negativa sobre `repetition_tolerance` con mayor peso que una respuesta inicial genérica.

### IA

- Una salida con una dimensión desconocida debe rechazarse.
- Una salida JSON inválida debe reintentarse y, después del límite, enviarse a revisión.
- La IA nunca debe escribir directamente en `reader_profile_dimensions`.

### Versionado

- **Una recomputación válida que produce el mismo `evidence_set_hash` del snapshot vigente NO debe crear un snapshot nuevo; debe devolver el existente.** Sólo crea snapshot si cambia el conjunto de evidencia activa o la `calculation_version`. Ver §26.3.
- Debe poder reconstruirse por qué una dimensión cambió entre dos versiones, consultando `profile_version_evidence` (§13.15) y comparando `evidence_fingerprint` activos entre snapshots.

---

## 20. Datos necesarios para machine learning futuro

Aunque el MVP sea determinista, siempre guardar:

- perfil y versión usados al seleccionar;
- contexto actual de la compra;
- catálogo disponible en ese momento;
- candidatos considerados;
- score y componentes por candidato;
- posición del candidato;
- libro seleccionado;
- intervención humana y motivo;
- si el libro se inició;
- porcentaje leído;
- si se terminó o abandonó;
- aspectos positivos y negativos;
- atribución libro/momento;
- intención de repetir;
- perfil resultante después del feedback.

Esto permitirá crear posteriormente datasets para:

- clasificación de satisfacción;
- predicción de abandono;
- learning-to-rank;
- filtrado colaborativo;
- recomendación híbrida;
- calibración de pesos;
- evaluación de sesgos de popularidad;
- análisis de retención.

No entrenar un modelo únicamente con `liked = true/false`.

---

## 21. Privacidad y seguridad

1. Las preferencias privadas deben cifrarse o protegerse con controles de acceso equivalentes a información sensible.
2. No incluir exclusiones privadas en logs de aplicación de texto plano.
3. No enviar al modelo de IA más información de la necesaria.
4. Separar perfil interno de cualquier resumen compartible.
5. El usuario debe poder editar o borrar preferencias privadas.
6. No realizar inferencias clínicas, psicológicas o demográficas.
7. Registrar consentimientos y versiones de términos aplicables.

### 21.1 Política de eliminación y anonimización de datos (v1)

- **Cuenta eliminada (soft delete)**: el `user_id` se anonimiza (`users.deleted_at` + sustitución de PII por hash); `reader_profiles`, `reader_evidence` y snapshots se conservan anonimizados para el dataset de ML futuro. Nunca se borran filas de evidencia por una baja de cuenta.
- **Borrado fuerte (estilo GDPR)**: el usuario puede solicitar borrado completo; se elimina `reader_profiles`, `reader_profile_versions`, `reader_tag_preferences`, `reader_profile_rules`, `question_answers`, `questionnaire_sessions`, `reader_evidence`, y el `user_id` se elimina de `recommendations`, `recommendation_selections`, `reading_feedback` (cascade o script documentado). Los `recommendation_candidates` y los `book_classification_audit` **se conservan** (no contienen PII del usuario).
- **Retention**: feedback y snapshots históricos se conservan indefinidamente en V1. Logs con `raw_output` de IA se conservan 90 días. `tag_taxonomy_audit` y `curator_action_audit` son permanentes.
- **Anonimización en aggregates**: cualquier exportación para ML nombra usuarios por `user_hash`, nunca por `user_id` original. Ver §20.
- **Trazabilidad del borrado**: cada operación de borrado o anonimización registra en `privacy_event_audit` (tabla mínima: `id`, `user_id_hashed`, `kind`, `executed_by`, `executed_at`, `payload_summary`).

---

## 22. No objetivos del MVP

- Recomendación completamente automática.
- Feed social.
- Perfil público.
- Seguimiento automático de páginas leídas.
- Integración universal de ebooks o audiolibros.
- Inferencias psicológicas profundas.
- Entrenamiento de machine learning.
- Optimización por popularidad como señal principal.
- Cuestionario generado libremente por IA.
- Redis / BullMQ (la idempotencia y el circuito de IA pueden implementarse con mecanismos del runtime sin depender de estos servicios en V1).
- `pgvector` (los embeddings vectoriales son post-MVP; el schema no los asume).
- Dependencia de un proveedor concreto de IA o de autenticación: ambos deben abstraerse tras interfaces (`AiEvidenceProposerPort`, `AuthPort`) para no acoplar el dominio.
- Cualquier infraestructura atada a un proveedor específico de IA. La IA puede proponer, pero su salida siempre pasa por validación de schema y por revisión humana cuando aplique.

---

## 23. Orden recomendado de implementación

### Fase 1: fundamentos

1. Crear taxonomía versionada.
2. Crear tablas de preguntas y mapeos.
3. Implementar sesiones y respuestas.
4. Implementar evidencia.
5. Implementar agregación de valor y confianza.
6. Crear snapshots de perfil.

### Fase 2: catálogo

1. Crear libros, ediciones, features y tags.
2. Construir panel de clasificación manual.
3. Añadir clasificación asistida por IA con revisión humana.

### Fase 3: recomendación

1. Implementar filtros duros.
2. Implementar scoring determinista.
3. Guardar candidatos y componentes.
4. Crear pantalla de curaduría.

### Fase 4: feedback

1. Implementar flujo adaptativo.
2. Crear evidencias desde feedback.
3. Interpretar texto libre con IA.
4. Recalcular perfil.
5. Medir segunda compra y satisfacción de selección.

---

## 24. Decisiones cerradas para la versión 1

- Escala interna: `0..1`.
- Desconocido: `null`, no `0.5`.
- Confianza calculada por backend.
- Cuestionario inicial: 12–14 ítems, máximo tres ramificaciones.
- Preguntas sobre libros previos: opcionales.
- Sin lista obligatoria de 100 libros.
- Contenido privado: campo opcional no intrusivo.
- IA: extracción y clasificación, no decisión final.
- Curaduría humana obligatoria en MVP.
- PostgreSQL + `JSONB`.
- Perfil, evidencia y preguntas versionados.
- Guardar todos los candidatos de recomendación.
- El feedback real pesa más que el onboarding.

---

## 25. Definición de terminado

La primera implementación se considera completa cuando:

1. Un usuario puede completar el onboarding.
2. Se genera un perfil con valores, confianza y evidencia trazable.
3. Las dimensiones desconocidas permanecen en `null`.
4. Un curador puede clasificar libros con la misma taxonomía.
5. El sistema puede ordenar candidatos y explicar el resultado.
6. El curador puede seleccionar un libro.
7. El usuario puede enviar feedback adaptativo.
8. El feedback modifica el perfil mediante reglas deterministas.
9. Cada modificación genera una nueva versión del perfil.
10. Es posible reconstruir toda la cadena desde respuesta original hasta recomendación y resultado.

---

## 26. Decisiones transversales v1.1.1

Esta sección consolida las decisiones cross-cutting introducidas en 1.1.0 y corregidas en 1.1.1. Prevalecen sobre cualquier silencio anterior del documento.

### 26.1 Locking optimista

- Toda mutación a `reader_profiles`, `reader_profile_dimensions`, `reader_profile_rules`, `reader_tag_preferences`, `books`, `book_features`, `book_editions`, `recommendations`, `recommendation_selections`, `questionnaire_sessions` usa `optimistic_lock_version` (o `current_version` en `reader_profiles` como doble control).
- Patrón: `UPDATE … WHERE id = $1 AND optimistic_lock_version = $2` con `RETURNING`; si rowCount = 0 → `409 Conflict`.
- Recompute y feedback usan el mismo patrón al reservar su `profile_version` antes de escribir.

### 26.2 Snapshot meta

Cada `reader_profiles.snapshot_json` y cada `reader_profile_versions.snapshot_json` lleva:

```json
{
  "calculation_version": "prof-calc/1.0",
  "classifier_version": "book-tax/1.0",
  "tag_taxonomy_version": "tag-tax/1.0",
  "prompt_version": "prompt/evidence-extract/v1",
  "evidence_set_hash": "<sha256>",
  "computed_at": "2026-07-30T20:00:00Z"
}
```

Sin estos campos el snapshot es inválido.

### 26.3 Recomputación idempotente por `evidence_set_hash`

- `evidence_set_hash` = SHA-256 sobre el conjunto ordenado y canonizado de `evidence_fingerprint` de todas las evidencias activas del `user_id` (orden lexicográfico asc; sin saltos de línea entre elementos).
- En `/recompute`:
  1. cargar evidencias activas;
  2. computar `candidate_hash` con la misma fórmula;
  3. comparar con `snapshot_json.evidence_set_hash` del `profile_version` actual;
  4. si son iguales Y `calculation_version` coincide → **devolver el snapshot existente, no crear nueva versión**, devolver `200` con `profile_version` vigente;
  5. si difieren → computar nuevo perfil, bump `profile_version`, persistir nueva `reader_profile_versions`, actualizar `reader_profiles`.
- Esto reduce snapshots idénticos y hace `/recompute` seguro para retries desde clientes.

### 26.4 `evidence_fingerprint` y constraint único

- `evidence_fingerprint = sha256( source_id || dimension_key || reason_code || observed_value || canonical(raw_payload) )`, todos como strings canonizadas (LFN normalizado, claves ordenadas).
- Constraint `UNIQUE (evidence_fingerprint)` en `reader_evidence`. Insertar dos evidencias idénticas provoca `409` (o se ignora según política del endpoint); nunca dos filas duplicadas.
- Cambios de peso (factor) NO cambian el fingerprint: si se ajustan pesos, el fingerprint sigue impidiendo duplicidad lógica; el recomput recalcula pesos a partir de la config vigente.

### 26.5 Cuestionario y sesiones

- `questionnaire_sessions.questionnaire_version` se fija al crear la sesión a partir del banco vigente publicado.
- Una sesión existente **continúa en su versión** aunque se publique otra `questionnaire_version`; nunca se cambia el `questionnaire_version` de una sesión ya creada.
- Si un usuario tiene una sesión abierta con `status = started` o `abandoned` y hay una nueva versión publicada, se le ofrece retomar la sesión existente; nunca se fuerza la migración.
- `is_required = true` y `branching_rules_json` se resuelven con el `question_definition.version` correspondiente a la sesión.

### 26.6 Respuestas parciales y `ready_to_recommend`

- Las respuestas de una sesión `abandoned` o incompleta **se conservan** en `question_answers` y producen evidencia (con peso reducido según §8.2).
- `onboarding_core_dimensions` (12) — dimensiones estables cubiertas por el cuestionario inicial (canon en `scoring_weights_spec.md` §10.2):
  ```
   hook_need, pace_preference, open_ending_tolerance,
   character_depth_need, moral_ambiguity_tolerance, distinct_voice_need,
  style_clarity_preference, ornate_prose_tolerance,
  tension_preference, comfort_preference,
  linguistic_complexity_tolerance, conceptual_depth_appreciation
  ```
- El perfil no se marca `ready_to_recommend = true` hasta:
  1. tener al menos una sesión con `status = completed` en su `questionnaire_version` donde TODAS las preguntas `is_required = true` (ver §6.3) fueron respondidas;
   2. la sesion tiene `status = completed`;
   3. hay al menos una dimension conocida en narrativa/ritmo, personajes, estilo/exigencia y experiencia emocional, `discovery_appetite` conocido y al menos ocho dimensiones numericas conocidas;
   4. existen limites de paginas validos, preferencia de serie, al menos un idioma y al menos un formato aceptado. En el MVP fisico, `accepted_formats = ["physical"]` con `format_source = "product_default"` si el formulario no solicita formato.
- `onboarding_core_coverage`, `global_profile_coverage` y `evidence_maturity` quedan **sólo como metricas diagnosticas**, no son gates.
- Antes de eso, el perfil existe y se puede inspeccionar, pero el scoring no lo consume en una `recommendation` nueva (o lo consume con `recommendation_evidence_coverage` muy bajo y alerta visible al curador).

### 26.7 Sin temporal decay en V1

- Las evidencias **no pierden peso por antigüedad** en V1.
- Toda evidencia conserva `created_at` (timestamp) para permitir experimentar con decay en versiones futuras sin migración.
- El único control temporal en V1 es el `exposure_factor` (progreso de lectura), no la edad.
- En V2+ se podrá especificar un `decay_function` por `source_type`; el campo `created_at` ya está disponible, así que la migración no requiere reescribir evidencia.

### 26.8 Ciclo de vida de recomendaciones

Definido en §17.1. Invariante: sólo una `recommendation_selection` con `status IN ('selected','sent')` por `recommendation_id`; las `deselected` y `canceled` se conservan para auditoría. Cualquier cambio es atómico (transacción con `optimistic_lock_version`).

### 26.9 Idioma por edición y aritmética decimal

- El filtro de idioma del §14.1 consulta `book_editions.language`, nunca `books.original_language`.
- Toda aritmética se realiza con decimal exacto (`NUMERIC`, `Decimal.js` o equivalente), orden canónico de claves lexicográfico asc, redondeo `HALF_UP` a 4 decimales una sola vez al persistir cada componente (ver `scoring_weights_spec.md` §2 y §3).
- Nunca usar coma flotante binaria para persistencia ni para comparaciones de igualdad.

### 26.10 Audit log de curador

Tabla `curator_action_audit`:

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `actor_id` | UUID |
| `actor_role` | enum (`curator`, `curator_lead`, `admin`) |
| `action_kind` | enum (`select_book`, `deselect_book`, `reselect_book`, `send_book`, `approve_feature`, `block_feature`, `override_feature`, `discard_classification_source`, `add_tag`, `merge_tag`, `deprecate_tag`, `edit_question_doc`...) |
| `target_type` | enum (`recommendation`, `recommendation_candidate`, `recommendation_selection`, `book_feature`, `tag_identity`, `tag_version`, `question_definition`) |
| `target_id` | UUID |
| `reason` | text |
| `payload_diff_json` | JSONB |
| `created_at` | timestamptz |

- Toda acción del curador documenta `actor_id` y `reason`. Toda transición de estado de §17.1 escribe aquí.
- Es Append-only; nunca se actualizan ni se borran filas.
- En caso de `deselect`/`reselect` se persisten ambas filas (la `deselect` y la `reselect`) con `target_id` referenciando a la `recommendation_selection` correspondiente.

### 26.11 Estímulos y fragmentos inmutables

- `Q06_STYLE_FRAGMENT` (y cualquier pregunta futura con estímulo) incluye un `stimulus_ref` en `question_definitions.branching_rules_json` / `validation_json` que apunta a `stimuli` (tabla mínima: `id`, `question_id`, `option_key`, `stimulus_hash`, `content_text`, `language`, `active`).
- Los estímulos son **inmutables por `question_version`**:变更 sólo a través de nueva versión de pregunta. El `raw_response.stimulus_hash` permite reconstruir exactamente qué vió el usuario.
- El `content_text` de un `stimulus` nunca se edita; se crea uno nuevo con nueva `question_definition.version`.

### 26.12 Proveedor de IA abstraído

- Toda interacción con el proveedor de IA pasa por una interfaz `AiEvidenceProposerPort` (definida por dominio). Implementaciones concretas (Anthropic, OpenAI, etc.) viven en un módulo de infraestructura.
- Sustituir el proveedor no cambia el contrato de §15.3 ni las validaciones del backend.
- Las salidas de IA se validan contra JSON Schema **antes** de cualquier persistencia; el `prompt_version` y `model` se guardan en `evaluation_meta_json` y en `source_support_json.contributions[].prompt_version`.
- No se incluye ningún SDK concreto en el dominio; las dependencias de infra sólo viven en módulo `infrastructure/ai`.

### 26.13 JSON Schema cerrado de `conditional_rules`

`reader_profile_rules.condition_json` y `effect_json` se validan contra este schema. Toda regla está versionada y soporta tres `effect_kind`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "reader-profile/conditional-rule/1.1",
  "type": "object",
  "required": ["rule_key", "version", "when", "effect"],
  "additionalProperties": false,
  "properties": {
    "rule_key": { "type": "string", "pattern": "^[a-z][a-z0-9_]{2,79}$" },
    "version": { "type": "integer", "minimum": 1 },
    "when": {
      "type": "object",
      "required": ["if_all"],
      "additionalProperties": false,
      "properties": {
        "if_all": {
          "type": "array", "minItems": 1,
          "items": { "$ref": "#/$defs/predicate" }
        },
        "if_any": {
          "type": "array", "minItems": 1,
          "items": { "$ref": "#/$defs/predicate" }
        }
      }
    },
    "effect": {
      "type": "object", "additionalProperties": false,
      "required": ["effect_kind"],
      "properties": {
        "effect_kind": { "enum": ["block", "penalty", "review"] },
        "block_reason": { "type": "string" },
        "penalty_amount": { "type": "number", "minimum": 0, "maximum": 0.05 },
        "auditor_role": { "enum": ["curator", "curator_lead", "admin"] }
      }
    },
    "reason": { "type": "string" }
  },
  "$defs": {
    "predicate": {
      "type": "object", "additionalProperties": false,
      "required": ["target", "key", "operator", "threshold"],
      "properties": {
        "target": { "enum": ["book_feature", "book_tag", "reader_dimension"] },
        "key": { "type": "string", "pattern": "^[a-z][a-z0-9_]{2,79}$" },
        "operator": { "enum": ["gte", "lte", "gt", "lt", "eq", "neq"] },
        "threshold": { "type": "number", "minimum": -1, "maximum": 1 }
      }
    }
  }
}
```

Reglas operativas:

- `effect = block` ⇒ el candidato queda `review_status = blocked` con `block_reason`. Persistir en `recommendation_candidates.block_reason` y la regla en `risk_penalty_breakdown_json.conditional_rule_blocks[]`.
- `effect = penalty` ⇒ añade `penalty_amount` a `conditional_rule_penalty` (ver `scoring_weights_spec.md` §5.6.3). Persistir en `risk_penalty_breakdown_json.conditional_rule_penalties[]`.
- `effect = review` ⇒ el candidato entra al ranking pero aparece con flag `needs_human_review = true` en el panel; no penaliza el score.
- Las reglas con status `superseded` no se evalúan; las `active` sí; las `rejected` nunca.
- Toda regla debe tener `evidence_count >= 2` para ser `active` (evidencia de contradicción o coincidencia sostenida).

### 26.14 Catálogo cerrado de `soft_aversion_definitions`

Las `soft_aversions` perfiladas (ver JSON §10 de `reader_profile`) se controlan por este catálogo. Cada entry define un `soft_aversion_key`, una `condition_json` (predicates sobre book features/tags, mismos que §26.13 `$defs/predicate`), y semántica:

```json
{
  "soft_aversion_key": "repetitive_internal_monologue",
  "description": "Monólogo interno redundante o introspección repetitiva que rompe el ritmo.",
  "condition_json": {
    "if_all": [
      { "target": "book_feature", "key": "introspection_density", "operator": "gte", "threshold": 0.70 },
      { "target": "book_feature", "key": "repetition_level",     "operator": "gte", "threshold": 0.60 }
    ]
  },
  "default_reader_confidence_cap": 0.75
}
```

Catálogo v1 (cerrado, versionado `tag-tax/1.0.1`):

| `soft_aversion_key` | Predicates (simplificado) | Descripción |
|---|---|---|
| `repetitive_internal_monologue` | `introspection_density >= 0.70` AND `repetition_level >= 0.60` | Monólogo interno redundante |
| `slow_burn_without_payoff` | `slow_burn_level >= 0.65` AND `narrative_payoff <= 0.40` | Lentitud sin recompensa narrativa |
| `excessive_worldbuilding_load` | `worldbuilding_load >= 0.85` AND `attention_demand >= 0.75` | Worldbuilding opresivo que ahoga la trama |
| `ornate_prose_without_plot` | `ornate_prose >= 0.80` AND `narrative_payoff <= 0.40` | Prosa ornamentada sin avance narrativo |
| `unrelatable_protagonist` | `character_likability <= 0.30` AND `character_depth <= 0.40` | Antagonista sin redención, sin profundidad |
| `preachy_lacking_ambiguity` | `moral_ambiguity <= 0.20` AND `conceptual_density >= 0.70` | Tesis moral explícita con densidad conceptual |
| `graphic_violence_explicit` | tag `violence_explicit` strength `>= 0.80` (tag de theme aún por añadir en v1.1) | Violencia gráfica persistente |
| `infodump_worldbuilding` | `worldbuilding_load >= 0.75` AND `dialogue_ratio <= 0.20` | Exposición volcada en bloque |

Reglas:

- Tabla `soft_aversion_definitions` enumerada (`soft_aversion_key` PK, `condition_json`, `description`, `taxonomic_version`, `is_active`).
- El lector no elige `soft_aversions` del catálogo; surgen del perfil cuando un patrón de feedback negativo recurrente cumple `evidence_count >= 2`. La creación se hace en `FeedbackProcessingService`.
- `default_reader_confidence_cap = 0.75` por riesgo: una `soft_aversion` con `confidence > cap` se recorta.
- Las `soft_aversions` perfiles se persisten en `reader_profiles.snapshot_json.soft_aversions[]` con `{ soft_aversion_key, confidence, evidence_count, evidence_ids[] }`.
- Toda `soft_aversion` activa se evalúa en `risk_penalty` §5.6.2 (`scoring_weights_spec.md`).

---

## 27. Matriz automatizable de invariantes cross-document y validación de keys

### 27.1 Matriz de invariantes

Cada invariante debe cumplirse en todos los archivos listados; el script `validate_specs.mjs` (futuro) recorre con regex/AST y reporta cada fila.

| # | Invariante | Afirmada por | Consumida por | Estado v1.1.1 |
|---|---|---|---|---|
| INV-01 | Toda `book_feature_key` usada en scoring está definida en `book_taxonomy_spec.md` §3 | book_tax §3 | scoring §5, reader_profile §5 | ✅ |
| INV-02 | Toda `dimension_key` del lector tiene `book_feature_key` espejo definido | reader_profile §5 | scoring §5.1, book_tax §12.2 | ✅ |
| INV-03 | `book_tag_strength ∈ [0,1]`; `user_affinity ∈ [-1,1]` | tag_tax §8 | scoring §5.3 | ✅ |
| INV-04 | Toda `tag_key` en mappings o catálogos está en `tag_taxonomy_v1.md` §4 | tag_tax §4 | reader_profile §6.2 (Q11), F-mappings | ✅ |
| INV-05 | Toda `soft_aversion_key` usada en `risk_penalty` está definida en §26.14 | reader_profile §26.14 | scoring §5.6.2 | ✅ |
| INV-06 | `effective_weight = dimension_weight × reader_confidence × book_confidence`; `numeric_fit_score = Σ_EWC / Σ_EW` | scoring §5.1 | reader_profile §14.2, §14.6 | ✅ |
| INV-07 | No existe `coverage_adjustment` ni `low_evidence_penalty` en scoring | scoring §5.2, §5.6 | reader_profile §14.6 | ✅ |
| INV-08 | No existe `tag_domain_weight`; `Σ domain_weight[d ∈ 1..6] = 1.0000` | scoring §4.2 | reader_profile §14 | ✅ |
| INV-09 | `null` no se imputa como `0.5` en `goal_fit`, `emotion_fit`, `discovery_fit_score` | scoring §5.4, §5.5 | reader_profile §14 | ✅ |
| INV-10 | `ready_to_recommend = required_questions_complete AND questionnaire_session_completed AND minimum_signal_set_satisfied AND operational_constraints_complete`; no usa coverage ni maturity como gate | scoring §10.6 | reader_profile §26.6 | ✅ |
| INV-11 | `question_definitions` usa `UNIQUE(question_key, version)` no `UNIQUE(question_key)` | reader_profile §13.2 | (DDL) | ✅ |
| INV-12 | `evidence_set_hash` vive en `reader_profile_versions.snapshot_json` y `reader_profiles.snapshot_json`, no en `reader_evidence` | reader_profile §13.9, §26.2 | scoring §3, §12 | ✅ |
| INV-13 | `reader_evidence` tiene `status`, `superseded_by`, `deactivated_at` | reader_profile §13.9 | scoring (carga evidencias `active`), `FeedbackProcessingService` | ✅ |
| INV-14 | `profile_version_evidence` permite reconstruir qué evidencias alimentaron cada snapshot | reader_profile §13.15 | scoring §12 (test 10), auditoría | ✅ |
| INV-15 | `tag_definitions` reemplazado por `tag_identity` + `tag_versions` | tag_tax §11 | reader_profile §13.13 | ✅ |
| INV-16 | `books.author_ids UUID[]` no existe; `authors` + `book_authors` sí | book_tax §12.1, §12.1a, §12.1c | reader_profile §13.13 | ✅ |
| INV-17 | `direction` en `reader_evidence` definido: `+1` a favor, `-1` en contra; no entra en `final_weight` | reader_profile §13.9 | scoring, conditional rules | ✅ |
| INV-18 | `recompute` idempotente: mismo `evidence_set_hash` + mismo `calculation_version` ⇒ mismo `profile_version`, sin snapshot nuevo | reader_profile §26.3, §18 | scoring §12 (test 10) | ✅ |
| INV-19 | `reading_requests` incluye `budget_amount`, `budget_currency`, `delivery_region`, `allow_used_books`, `secondary_goals` | reader_profile §13.12 | scoring §5.4.4, reader_profile §14.1 | ✅ |
| INV-20 | `series_membership` enum + `series_id` + `series_position` en `books`; filtro saga en §14.1 | book_tax §12.1, reader_profile §14.1 | reader_profile §13.13 | ✅ |
| INV-21 | `length_fit` y `reading_time_fit` usan `pages` (physical/ebook) o `audio_minutes` (audiobook) según edición | scoring §5.4.1, §5.4.2 | reader_profile §13.13 | ✅ |
| INV-22 | `available_energy` modula `effort_fit`; `secondary_goals[]` modula `goal_fit_combined` | scoring §5.4.4, §5.4.6 | reader_profile §13.12 | ✅ |
| INV-23 | `author_novelty_indicator` se usa en `book_discovery_profile` | scoring §5.5 | book_tax §3.2 | ✅ |
| INV-24 | `conceptual_depth_appreciation` (lector) ↔ `conceptual_depth` (libro); mapeo `ideas → {6: 1.0}` sobre ésta | reader_profile §5 d6, scoring §4.1, book_tax §3.1 d6 | scoring §4.1 | ✅ |
| INV-25 | `conditional_rules` validados contra JSON Schema §26.13 con `effect_kind ∈ {block, penalty, review}` | reader_profile §26.13, §9.7 | scoring §5.6.3, §7.1 | ✅ |
| INV-26 | Catálogo cerrado de `soft_aversion_definitions` §26.14; no se inventan claves nuevas | reader_profile §26.14 | scoring §5.6.2 | ✅ |
| INV-27 | `onboarding_core_dimensions` = 12 (canónicas); `global_profile_coverage` sólo diagnóstica | scoring §10.1, §10.2 | reader_profile §26.6 | ✅ |
| INV-28 | `scoring_required_minimum` = 10, `core_required_for_scoring` = 20 (única lista) | book_tax §9.2 | scoring §5.6.1, §12 (test 11) | ✅ |
| INV-29 | Estímulos (`Q06`) inmutables por `question_version`; `stimulus_hash` en `raw_response` | reader_profile §26.11 | (UI, auditoría) | ✅ |
| INV-30 | Proveedor IA abstraído tras `AiEvidenceProposerPort`; salidas validadas por JSON Schema | reader_profile §26.12, §15.3 | scoring, reader_profile §16 | ✅ |

### 27.2 Auditoría de keys usadas vs definidas (validación final)

Recorrido automatizable con `grep -E` por familia:

#### 27.2.1 `book_feature_key`

**Definidas en** `book_taxonomy_spec.md` §3.1 (tabla maestra) + §3.2 (auxiliares): 39 + 3 auxiliares = 42 totales.

- **39 dimensionales**: `hook_speed, narrative_pace, event_density, slow_burn_level, narrative_payoff, linearity, multi_pov_load, temporal_fragmentation, ambiguity, ending_openness, conflict_clarity, character_depth, character_likability, moral_ambiguity, relationship_focus, voice_distinctiveness, character_agency, style_clarity, ornate_prose, introspection_density, repetition_level, experimentation_level, descriptive_density, dialogue_ratio, tension_level, comfort_level, humor_level, darkness_level, emotional_intensity, sadness_level, strangeness_level, hope_level, linguistic_complexity, structural_complexity, conceptual_density, cast_size_load, worldbuilding_load, attention_demand, conceptual_depth`.
- **3 auxiliares**: `popularity_score, discovery_profile, author_novelty_indicator`.

**Usadas en** `scoring_weights_spec.md` §5.4 (goal_fit table, emotion_fit table, effort_fit), §5.5 (discovery), §11 (ejemplo). Cross-check por grep: ninguna feature fuera de la lista aparece en scoring.

✅ No hay `book_feature_key` usadas pero no definidas. (Eliminadas en 1.1.1: `nonfiction_indicator`, `low_pages`, `atmospheric_indicator`.)

#### 27.2.2 `dimension_key` del lector

**Definidas en** `src/profile/catalog.ts` (source of truth) y documentadas en `reader_profile_spec.md` §5. 39 numeric dimensions and 4 discovery selection controls (43 active keys total). `conceptual_depth_appreciation` es una dimension numerica estable y no debe eliminarse.

- Los `book_feature_key` espejos en `book_taxonomy_spec.md` §3 cubren las dimensiones numericas, incluido `conceptual_depth` para `conceptual_depth_appreciation`. Los selection controls de discovery documentan su uso de scoring aunque no requieran una comparacion numerica directa.

**Usadas en** mappings (§6.2 banco de preguntas, Q09/Q10 normative tables, F05/F06 normative tables) y scoring §11 ejemplo.

✅ Toda `dimension_key` usada en mapping o scoring está definida en §5 con `book_feature_key` espejo.

#### 27.2.3 `tag_key`

**Definidas en** `tag_taxonomy_v1.md` §4 (catálogo v1.0.1): 129 etiquetas activas + 1 deprecated (`anglo_american`).

**Usadas en**:
- `scoring_weights_spec.md` §5.3: genérico, sin cite de `tag_key` concreto.
- `reader_profile_spec.md` §6.2 Q11: selector (los tags al usuario son del catálogo).
- F05/F06: alias `violence_explicit` mencionado — marcado como "aún por añadir en v1.1" (ver INV-? en `soft_aversion_definitions` v1.0.1, registry pendiente). En v1.0.1 NO se usa para scoring si no existe; la regla de `soft_aversion` que lo cita queda `pending_tag_addition` y no se aplica hasta bump de taxonomía.

✅ Salvo la nota sobre `violence_explicit` (pendiente, sin uso activo), no hay `tag_key` usada pero no definida.

#### 27.2.4 `soft_aversion_key`

**Definidas en** §26.14: 8 entrys.

**Usadas en** `scoring_weights_spec.md` §5.6.2 (referenciada en general) y ejemplo §11.

✅ Coincidencia; `soft_aversion_penalty` del ejemplo se basa en `repetitive_internal_monologue`, definida en §26.14.

#### 27.2.5 `primary_goal`, `desired_emotion`, `secondary_goal`

**Definidas en**:
- `primary_goal`: §10 (dominio 10) — 10 valores: `disconnect, leave_reading_slump, learn, feel_tension, comfort, catharsis, challenge, short_read, immersion, discovery`.
- `desired_emotion`: §11 (feedback) y §10 (`desired_emotions[]`): 9 valores: `tension, curiosity, fun, comfort, sadness, wonder, discomfort, hope, reflection`.

**Usadas en** `scoring_weights_spec.md` §5.4.3 (`goal_fit` table — cubre los 10 `primary_goal`) y §5.4.5 (`emotion_fit` table — cubre los 9 `desired_emotion`).

✅ Sin keys usadas fuera del catálogo.

#### 27.2.6 Variables eliminadas

Sin ocurrencias restantes en cálculos activos (pueden aparecer en changelogs y diff tables):

- `coverage_adjustment` — eliminado de §7.3, §8 persistencia, §11 diff (sólo mencionado con ``(eliminado)``).
- `low_evidence_penalty` — mismo.
- `tag_domain_weight` — mismo.
- `nonfiction_indicator`, `low_pages`, `atmospheric_indicator` — eliminados en §5.4.3, no referenciados en §8.

#### 27.2.7 Conclusión

No existe ninguna `*_key` o variable de scoring usada en fórmulas o persistencia que no esté definida en este documento o en los complementarios. La utilidad `validate_specs.mjs` puede implementarse como `grep + AST` sobre los cuatro archivos markdown.

---

## 28. Diferencias con v1.1.0

Esta sección es un changelog de alto nivel para auditar la transición 1.1.0 → 1.1.1 sin leer todo el changelog largo:

- v1.1.0 introdujo `tag_domain_weight = 0.15`, `coverage_adjustment`, `low_evidence_penalty`, mapping `ideas → conceptual_density_tolerance` (con efectos colaterales). v1.1.1 **elimina** los tres primeros y redefine `ideas → conceptual_depth_appreciation` con `conceptual_depth` como nuevo `book_feature_key`.
- `onboarding/1.1` y `prof-calc/1.1` separan `global_profile_coverage`, `onboarding_core_coverage` y `evidence_maturity` como metricas diagnosticas de los gates operativos de readiness.
- v1.1.1 añade: `series` / `authors` / `book_authors`, `profile_version_evidence`, `tag_identity` + `tag_versions`, semántica explícita de `direction` en `reader_evidence`, budget/region/used_books en requests, `effort_fit`, `secondary_goals`, mappings normativos Q09/Q10/F05/F06, JSON Schema de `conditional_rules`, `soft_aversion_definitions` catálogo.

El documento se considera estable para empezar el planeamiento del build posterior.
