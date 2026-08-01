# Especificación técnica: taxonomía y clasificación de libros

**Documento:** `book_taxonomy_spec.md`
**Versión:** `1.1.0`
**Estado:** complemento normativo de `reader_profile_spec.md` v1.1.1
**Audiencia:** backend, curaduría editorial, agentes de IA, producto
**Escala interna canónica:** `NUMERIC(5,4)` en `0.0000..1.0000`
**Base de datos:** PostgreSQL 16

## Changelog 1.1.0

- Añade `conceptual_depth` como feature del dominio 6 (espejo de `conceptual_depth_appreciation` del lector).
- Define `core_required_for_scoring` (20) y `scoring_required_minimum` (10) para elegibilidad escalada.
- Reemplaza `feature_coverage_ratio >= 0.80` por umbral sobre `scoring_required_minimum`.
- Añade tabla `series` + `series_id`/`series_position` en `books`.
- Reemplaza `books.author_ids UUID[]` por `authors` + `book_authors`.
- Elimina menciones a `nonfiction_indicator`, `low_pages`, `atmospheric_indicator` (no existen).
- Corrige typos residuales («silkər», «detektive», «excertp_ref», «loza»).
- Alinea counts de core (20 único).

---

## 1. Objetivo

Definir el catálogo canónico de `book_feature_key`, el método de clasificación de cada feature, el cálculo determinista de `book_feature.confidence` **sin utilizar la confianza autodeclarada por un LLM**, el tratamiento de valores `null`, la cobertura mínima para que un libro sea candidato, la reconciliación de discrepancias entre fuentes y el ciclo de revisión humana y versionado de la clasificación.

Complementa al `reader_profile_spec.md`. Cualquier silencio en este documento se resuelve a favor del spec principal.

---

## 2. Convenciones

1. Toda feature del libro usa la misma escala `0..1` que las dimensiones del lector (`NUMERIC(5,4)`).
2. `null` significa “no hay evidencia suficiente”. Nunca `0.50` como neutro implícito.
3. Las claves son estables, `snake_case`, en inglés.
4. La clasificación se asocia a la **obra** (`books`), no a la edición, salvo el grupo de features *dependientes de edición* definido en §12.
5. Toda clasificación queda persistida con `classifier_version` y `source_support_json`.
6. La IA puede proponer valores y citar texto, pero **no puede establecer la confianza** ni resolver discrepancias.
7. Toda salida de IA se valida contra JSON Schema antes de ser considerada fuente.

---

## 3. Catálogo canónico de `book_feature_key`

Son 39 features (38 dimensiones del lector + `conceptual_depth`) agrupadas en los seis dominios de libro, que espejean los dominios 1, 2, 3, 4, 5 y 6 del lector. Los dominios 7 (tags), 8 (restricciones), 9 (descubrimiento) y 10 (contexto) no generan `book_feature_key` continuo; sus contrapartes se describen en `tag_taxonomy_v1.md` y en el catálogo de `book_editions`.

### 3.1 Tabla maestra

Cada fila declara: `key`, `domain`, `dimension_kind` (espejo del lector), `method` (clave de método de §4), y anclas semánticas para `0.00, 0.25, 0.50, 0.75, 1.00`.

#### Dominio 1 — tracción narrativa y ritmo

| `book_feature_key` | `dimension_kind` | `method` | 0.00 | 0.25 | 0.50 | 0.75 | 1.00 |
|---|---|---|---|---|---|---|---|
| `hook_speed` | `minimum_required` | `narrative_analysis` | arranque muy paciente, evento desencadenante tras cap. 6+ | arranque lento con un anzuelo hacia cap. 3–5 | arranque estable, anzuelo en cap. 1–2 | gancho temprano en las primeras 20 páginas | gancho inmediato en la primera página |
| `narrative_pace` | `target` | `narrative_analysis` | muy lento, casi contemplativo | lento controlado | ritmo medio estable | ritmo ágil | ritmo muy rápido, sin respiro |
| `event_density` | `target` | `narrative_analysis` | escasos eventos, contemplativo | eventos puntuales | densidad media | sucesión frecuente de eventos | eventos densos, casi no hay pausa |
| `slow_burn_level` | `maximum_tolerated` | `narrative_analysis` | sin slow burn, todo explícito | aire slow burn tímido | slow burn moderado | slow burn sostenido | slow burn extremo, tensión demorada |
| `narrative_payoff` | `minimum_required` | `narrative_analysis` | contemplación pura, sin recompensa narrativa | recompensa leve | recompensa moderada | recompensa clara al final | gran recompensa, cierre contundente |

#### Dominio 2 — estructura, claridad y cierre

| `book_feature_key` | `dimension_kind` | `method` | 0.00 | 0.25 | 0.50 | 0.75 | 1.00 |
|---|---|---|---|---|---|---|---|
| `linearity` | `target` | `structural_analysis` | no lineal, fragmentado | saltos moderados | mayormente lineal con digresiones | lineal con episodios ordenados | estrictamente lineal cronológico |
| `multi_pov_load` | `maximum_tolerated` | `content_metadata` + `structural_analysis` | 1 punto de vista | 2 POV | 3 POV | 4–5 POV | 6+ POV o narrador colectivo |
| `temporal_fragmentation` | `maximum_tolerated` | `structural_analysis` | un único timeline lineal | digresiones temporales menores | dos timelines intercalados | múltiples timelines alternados | fragmentación temporal radical |
| `ambiguity` | `maximum_tolerated` | `narrative_analysis` + `review_aggregation` | todo explícito y claro | ambigüedad puntual | ambigüedad moderada, interpretable | alta ambigüedad deliberada | máxima ambigüedad, abierto a lecturas |
| `ending_openness` | `maximum_tolerated` | `structural_analysis` + `review_aggregation` | cierre completo y explicado | cierre con detalle implícito | cierre implied, sin puntualizar | final abierto a interpretación | final totalmente abierto/inconcluso |
| `conflict_clarity` | `minimum_required` | `narrative_analysis` | conflicto velado, jamás explicitado | conflicto implícito | conflicto identificable a medias | conflicto claro con esfuerzo | conflicto manifiesto desde el inicio |

#### Dominio 3 — personajes y relaciones

| `book_feature_key` | `dimension_kind` | `method` | 0.00 | 0.25 | 0.50 | 0.75 | 1.00 |
|---|---|---|---|---|---|---|---|
| `character_depth` | `minimum_required` | `character_analysis` | personajes planos | profundidad mínima | profundidad moderada | personajes trabajados | profundidad psicológica máx. |
| `character_likability` | `minimum_required` | `character_analysis` | protagonistas hostiles o antagonistas | difícil de empatizar | mezcla de rasgos | empatía sólida | muy atractivos/empáticos |
| `moral_ambiguity` | `maximum_tolerated` | `character_analysis` | moral binaria, claro | ambigüedad leve | ambivalencia puntual | alta ambigüedad moral | máxima ambigüedad, sin anclar |
| `relationship_focus` | `target` | `character_analysis` | sin relaciones significativas | relaciones marginales | relaciones presentes | relaciones centrales | libro dominado por relaciones |
| `voice_distinctiveness` | `minimum_required` | `style_analysis` | voces indistinguibles | voces ligeramente distintas | voces reconocibles | voces marcadas | voces muy diferenciadas |
| `character_agency` | `target` | `character_analysis` | personajes pasivos | reactivos, pocas decisiones | mezcla | impulsan parte de la trama | protagonistas activos, deciden todo |

#### Dominio 4 — estilo y voz

| `book_feature_key` | `dimension_kind` | `method` | 0.00 | 0.25 | 0.50 | 0.75 | 1.00 |
|---|---|---|---|---|---|---|---|
| `style_clarity` | `target` | `style_analysis` | opaco/indirecto | poco claro | claridad media | claro | muy claro y directo |
| `ornate_prose` | `maximum_tolerated` | `style_analysis` | prosa seca minimalista | prosa sencilla | prosa medida | prosa adornada | prosa ornamentada/barroca |
| `introspection_density` | `maximum_tolerated` | `style_analysis` | sin introspección | introspección puntual | introspección media | introspección frecuente | introspección dominante |
| `repetition_level` | `maximum_tolerated` | `style_analysis` | sin repetición notoria | leve eco | repetición deliberada media | repetición notable | repetición marcada, casi leitmotiv |
| `experimentation_level` | `maximum_tolerated` | `style_analysis` + `structural_analysis` | plenamente convencional | pequeña variación | mezcla convención e innovación | formato/lenguaje experimental | altamente experimental |
| `descriptive_density` | `target` | `style_analysis` | mínima descripción | descripción puntual | descripción media | descripción abundante | máxima descripción, casi pictórica |
| `dialogue_ratio` | `target` | `style_analysis` | casi sin diálogo | diálogo escaso | narración y diálogo balanceados | diálogo frecuente | dominado por diálogo |

#### Dominio 5 — experiencia emocional

| `book_feature_key` | `dimension_kind` | `method` | 0.00 | 0.25 | 0.50 | 0.75 | 1.00 |
|---|---|---|---|---|---|---|---|
| `tension_level` | `target` | `emotional_analysis` | sin tensión | tensión puntual | tensión media | tensión sostenida | tensión constante |
| `comfort_level` | `target` | `emotional_analysis` | muy incómodo | tenue confort | mezcla | reconfortante | plenamente reconfortante |
| `humor_level` | `target` | `emotional_analysis` | sin humor | humor puntual | humor medio | humor frecuente | humor dominante |
| `darkness_level` | `maximum_tolerated` | `emotional_analysis` | ligero/alegre | sombras puntuales | tono medio | tono oscuro | oscuridad extrema |
| `emotional_intensity` | `target` | `emotional_analysis` | tenue/sereno | puntual | intensidad media | intensa | intensidad emocional máxima |
| `sadness_level` | `maximum_tolerated` | `emotional_analysis` | sin tristeza | melancolía puntual | tristeza media | melancolía profunda | duelo o desgarro dominante |
| `strangeness_level` | `target` | `emotional_analysis` + `narrative_analysis` | familiar | ligero extrañamiento | mezcla | extraño sostenido | extrañeza radical |
| `hope_level` | `target` | `emotional_analysis` | desesperanzado | luz puntual | equilibrio | esperanzador | plenamente esperanzador |

#### Dominio 6 — exigencia cognitiva

| `book_feature_key` | `dimension_kind` | `method` | 0.00 | 0.25 | 0.50 | 0.75 | 1.00 |
|---|---|---|---|---|---|---|---|
| `linguistic_complexity` | `maximum_tolerated` | `style_analysis` | lenguaje simple | rarezas léxicas puntuales | exigencia media | lenguaje exigente | lenguaje muy exigente |
| `structural_complexity` | `maximum_tolerated` | `structural_analysis` | estructura simple | estructuras levemente elaboradas | estructura media | estructura compleja | estructura muy compleja |
| `conceptual_density` | `maximum_tolerated` | `narrative_analysis` + `review_aggregation` | sin ideas abstractas; la narración no exige procesar conceptos | ideas o conceptos aislados y esporádicos | presencia moderada de conceptos, reglas o explicaciones | denso: el lector procesa ideas y reglas con frecuencia | máxima densidad conceptual: conceptos, reglas o explicaciones casi constantes |
| `cast_size_load` | `maximum_tolerated` | `content_metadata` | 1–2 personajes | 3–5 | 6–10 | 11–20 | más de 20 |
| `worldbuilding_load` | `maximum_tolerated` | `narrative_analysis` | sin worldbuilding | leve | medio | denso | worldbuilding opresivo |
| `attention_demand` | `maximum_tolerated` | `cognitive_load_analysis` | lectura ligera | atención puntual | atención media | exige atención sostenida | exige atención sostenida máxima |
| `conceptual_depth` | `target` | `narrative_analysis` + `review_aggregation` | la obra no desarrolla ideas centrales más allá de la trama inmediata | presenta una idea reconocible, pero apenas la explora | desarrolla sus ideas con cierta reflexión y consecuencias visibles | las ideas son centrales y se exploran desde varias perspectivas o implicaciones | exploración filosófica, ética o conceptual profunda que domina y transforma la lectura de la obra |

### 3.2 Features auxiliares para scoring

Estos valores no son dimensiones del lector, pero son necesarios para `discovery_fit_score` y `context_fit_score` (ver `scoring_weights_spec.md`):

| `book_feature_key` | `method` | Significado | Rango |
|---|---|---|---|
| `popularity_score` | `curator_direct` \|\| `metadata` | Qué tan conocido/comprado es el título | `0` muy nicho → `1` bestseller |
| `discovery_profile` | `derived` | `1 - popularity_score` (más alto = más sorpresivo) | `0..1` |
| `author_novelty_indicator` | `metadata` | `0` autor súper conocido → `1` autor muy poco conocido | `0..1` |

Estas Features **no pertenecen al catálogo de 38 dimensiones** del lector; son datos auxiliares del libro y se persisten en `book_features` con `is_scoring_aux = true`.

---

## 4. Métodos de clasificación

Métodos enumerados y su definición operativa:

| `method` | Definición | Fuente(s) cubiertas |
|---|---|---|
| `narrative_analysis` | Análisis de sinopsis + muestra de los primeros capítulos; identifica cómo arranca, qué moviliza, dónde está el payoff | `publisher_synopsis`, `sample_text`, `ai_classification`, `review_excerpt` |
| `structural_analysis` | Análisis de estructura: orden temporal, saltos, cantidad de POV, tipo de cierre | `publisher_synopsis`, `sample_text`, `editor_metadata` |
| `character_analysis` | Análisis del reparto: profundidad, moral, relaciones, agencia | `sample_text`, `review_excerpt`, `ai_classification` |
| `style_analysis` | Análisis de una muestra textual (fragmentos seleccionados de distintos puntos) | `sample_text`, `review_excerpt` |
| `emotional_analysis` | Análisis de tono emocional predominante, con corrobora de reseñas | `sample_text`, `review_excerpt` |
| `cognitive_load_analysis` | Estimación de exigencia combinando muestra + reseñas + longitud | `sample_text`, `review_excerpt`, `editor_metadata` |
| `content_metadata` | Derivable directamente de metadata editorial (número de personajes, páginas, etc.) | `editor_metadata` |
| `review_aggregation` | Agregación de reseñas curadas con citas | `review_excerpt` |
| `curator_direct` | Solo el curador, normalmente para features auxiliares o controversiales | `curator_direct` |

Cada `book_feature_key` anuncia su `method` principal; el clasificador sólo acepta fuentes permitidas para ese método.

---

## 5. Fuentes aceptadas y pesos de confiabilidad

Cada fuente tiene un peso de confiabilidad base `r`:

| `source_type` | `r` | Restricción |
|---|---:|---|
| `curator_direct` | `1.00` | Solo humano; siempre permitido |
| `editor_metadata` | `0.95` | Válido sólo para features con `content_metadata` o longitud-familia |
| `publisher_synopsis` | `0.55` para features objetivas; `0.30` para subjetivas | No usar como única fuente para tono emocional o ambigüedad |
| `sample_text` | `0.60` | Requiere citar el fragmento exacto (`excerpt_ref`) |
| `review_excerpt` | `0.45` | Deben ser reseñas curadas, con cita y atribución |
| `author_interview` | `0.50` | Para features que el autor declara explícitamente |
| `ai_classification` | `0.40` | Cap de contribución: aporte máximo agregado de IA = `0.40` por feature |

Reglas:

1. La IA **no** declara su propia confianza. Toda salida IA se trata igual: contribuye a lo sumo `r = 0.40` al `source_agreement_weight`.
2. Una fuente puede aportar a varias features, pero cada feature tiene su propio `source_support_json`.
3. Las fuentes se deduplican por `(source_type, excerpt_ref)`. Si dos reseñas distintas aportan a la misma feature, ambas cuentan.

---

## 6. Cálculo de `book_feature.confidence`

### 6.1 Definición

Para una feature `f` del libro `b` con contribuciones de `n` fuentes distintas válidas:

1. Calcular el valor consensus `consensus_value`:

   ```text
   consensus_value = Σ_i (r_i × observed_value_i) / Σ_i r_i
   ```

2. Calcular la varianza entre las fuentes (sobre las desviaciones respecto a `consensus_value`):

   ```text
   source_variance = Σ_i r_i × (observed_value_i − consensus_value)^2 / Σ_i r_i
   ```

3. Penalización por desacuerdo (`disagreement_penalty`):

   ```text
   disagreement_penalty = clamp(1 − source_variance / 0.10, 0.40, 1)
   ```

   - Si `source_variance >= 0.04` la feature se marca `needs_review` (ver §10) aunque se persista el valor consensus.
   - Si `source_variance >= 0.10` la feature queda bloqueada para scoring y `value = null` hasta revisión.

4. Sumar acuerdos:

   ```text
   source_agreement_weight = Σ_i r_i
   ```

5. Confianza cruda:

   ```text
   confidence_raw = 1 − exp(−source_agreement_weight × disagreement_penalty / 2.0)
   ```

6. Caps y ajustes por revisión:

   - Caso A: feature aprobada por curador y `|curator_value − consensus_value| <= 0.10` →
     `confidence = clamp(confidence_raw + 0.10, 0, 0.95)`.
   - Caso B: curador rechaza todas las fuentes y fija `curator_value` sin apoyo →
     `confidence = 0.60`, `source_support_json.review_action = "override_no_source"`. Requiere seguimiento.
   - Caso C: sin revisión humana → `confidence = clamp(confidence_raw, 0, 0.90)`.
   - Caso D: única fuente es IA → `confidence <= 0.40` por cap; nunca mayor.

7. `value` final persistido = `consensus_value` redondeado a `NUMERIC(5,4)` con `HALF_UP`. Si el consenso resulta inestable (varianza alta y sin review) → `value = null`, `confidence = 0`.

### 6.2 Orden canónico y redondeo

- Sumar contribuciones ordenando por `source_type` asc y luego `excerpt_ref` asc.
- Redondeo único al final del cálculo por feature. Nunca redondear componentes intermedios.
- Ver `scoring_weights_spec.md` §3 para reglas compartidas de aritmética decimal.

### 6.3 Contrato de `source_support_json`

```json
{
  "feature_key": "hook_speed",
  "consensus_value": 0.68,
  "source_variance": 0.012,
  "contributions": [
    {
      "source_type": "ai_classification",
      "observed_value": 0.70,
      "r": 0.40,
      "excerpt_ref": "book_01J.../sample/ch01#p1-12",
      "rationale": "Anzuelo explícito en la primera página"
    },
    {
      "source_type": "review_excerpt",
      "observed_value": 0.65,
      "r": 0.45,
      "excerpt_ref": "rev_01J...",
      "rationale": "Reseña confirma arranque inmediato"
    }
  ],
  "review_action": null,
  "review_action_reason": null,
  "review_actor_id": null,
  "reviewed_at": null
}
```

---

## 7. Discrepancias entre fuentes

Se considera `discrepancy` cuando dos fuentes válidas distintas difieren en `|observed_value_i − observed_value_j| > 0.20` o `source_variance > 0.04`.

Reglas:

1. La IA **nunca** resuelve una discrepancia. Toda discrepancia se marca `needs_review`.
2. El backend persiste el `consensus_value` provisional con `review_status = needs_review`; no entra en scoring mientras tanto.
3. El curador elige una `review_action`:

   | `review_action` | Efecto |
   |---|---|
   | `confirm_consensus` | Acepta el consenso; se aplica Caso A de §6.1 |
   | `override_curator_value` | Reemplaza el consenso por `curator_value` (Caso B) |
   | `confirm_source_a` | Conserva sólo `source_a`; las demás se marcan `discarded` con razón |
   | `merge_weighted` | Recalcula consenso con pesos ajustados por el curador; razon guardado |
   | `block_feature` | Feature queda `value = null` con `review_status = blocked` |

4. Toda decisión queda en `review_action_reason`, `review_actor_id`, `reviewed_at`.

---

## 8. `book_value = null`

1. Significa: no hay evidencia suficiente para esa feature.
2. En scoring (`scoring_weights_spec.md`): la feature se excluye de `numeric_fit_score` y de `context_fit_score`. No aporta ni penaliza directamente, **no se imputa ningún valor neutro**.
3. Sí cuenta como **ausencia** en `coverage` (§9) y en sub-scores de contexto (reduciendo el divisor o forzando `null`).
4. No se persiste `value = 0.5` por omisión. Cualquier migración que viole esto rompe la invariante del §3.3 del spec principal.

---

## 9. Cobertura mínima para ser candidato

Define dos controles independientes:

### 9.1 Restricciones de edición (hard)

Son `book_editions` (ver §13). Un libro sin edición válida para la `reading_request` no es candidato:

- `format` aceptado por la request
- `language` aceptado por la request
- `pages` o `audio_minutes` presente (según formato)
- `availability_status != out_of_print` (a menos que la request permita usado) y `availability_regions` incluye la región del pedido
- `price <= request.budget` (si está definido)

### 9.2 Cobertura de features — elegibilidad escalada

El schema soporta 39 features, pero el MVP exige solo un subconjunto mínimo para entrar al ranking. Se definen tres roles:

#### 9.2.1 `scoring_required_minimum` (10) — gate hard para entrar al ranking

Estas 10 features deben tener `value != null` Y `confidence >= 0.20` Y `review_status = approved`. Si **cualquiera** falta, el candidato queda `needs_classification` (no entra al ranking):

```
hook_speed, narrative_pace, ending_openness,
character_depth, style_clarity,
tension_level, comfort_level,
linguistic_complexity, structural_complexity, conceptual_depth
```

Esto hace viable el MVP: el catálogo crece con curaduría humana sobre un subconjunto acotado.

#### 9.2.2 `core_optional_for_scoring` (10 adicionales) — entran si están `approved` o `draft` con confianza suficiente

Las siguientes 10 son core en sentido amplio pero no bloquean la elegibilidad inicial. Si están presentes y cumplen confianza mínima, entran a `numeric_fit_score`; si no, se excluyen (no penalizan):

```
slow_burn_level, narrative_payoff,
linearity, ambiguity, conflict_clarity,
moral_ambiguity, relationship_focus, voice_distinctiveness,
ornate_prose, darkness_level
```

`core_required_for_scoring` = `scoring_required_minimum` ∪ `core_optional_for_scoring` = **20 features** (lista única y definitiva).

#### 9.2.3 `non_core_aux` (resto)

Las 19 features restantes del catálogo + las 3 auxiliares (`popularity_score`, `author_novelty_indicator`, `discovery_profile`). Participan en scoring sólo si son no nulas y con confianza suficiente. No bloquean elegibilidad.

#### 9.2.4 `feature_coverage_ratio` (métrica diagnóstica)

```text
feature_coverage_ratio = count(scoring_required_minimum con value != null AND confidence >= 0.20) / 10
```

Ya no es gate hard. Es diagnóstica:计入 `recommendation_evidence_coverage` (ver `scoring_weights_spec.md` §10.3).

#### 9.2.5 `coverage_confidence_factor` (métrica para `risk_penalty`)

```text
scoring_minimum_confidence = avg(confidence over scoring_required_minimum features activas)
coverage_confidence_factor = scoring_minimum_confidence    # rango [0, 0.95]
```

Usado por `coverage_penalty` en `scoring_weights_spec.md` §5.6.

### 9.3 Confianza mínima del libro

Cualquier feature de `scoring_required_minimum` con `confidence < 0.20` equivale a `null` a efectos de elegibilidad (no se usa en scoring). Las `core_optional` y `non_core` siguen la misma regla cuando se usan.

---

## 10. Revisión humana: ciclo de vida de la clasificación

### 10.1 Estados de `book_features`

`review_status` enum:

- `draft` — creado, sin revisión
- `needs_review` — discrepancia o baja confianza
- `approved` — revisado y aceptado
- `blocked` — curador decidió no clasificar (feature queda `null` intencionalmente)
- `superseded` — reemplazado por una versión de clasificación posterior
- `rejected` — clasificación descartada (vuelve a `null` y se reagenda)

### 10.2 Transiciones permitidas

```text
draft -> needs_review -> approved
draft -> approved  (curador directo)
needs_review -> blocked
approved -> superseded  (al aplicar nueva classifier_version)
approved -> needs_review  (al recibir nueva fuente en conflicto)
draft | approved | needs_review -> rejected
blocked -> draft  (sólo por decisión curatorial documentada)
```

### 10.3 Bloqueo para scoring

Sólo features con `review_status = approved` entran en scoring. Las `draft` y `needs_review` cuentan como `null` para cobertura (§9.2). Las `blocked` también.

### 10.4 Audit log

Cualquier transición de estado escribe en `book_classification_audit`:

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `book_feature_id` | UUID FK |
| `from_status` | enum |
| `to_status` | enum |
| `actor_id` | UUID |
| `actor_role` | enum (`curator`, `system`, `admin`) |
| `reason` | text |
| `evidence_ref` | UUID nullable |
| `created_at` | timestamptz |

---

## 11. Versionado de clasificación

1. Toda row de `book_features` lleva `classifier_version` (formato `book-tax/MINOR`) y `classification_identity` (UUID único por par `(book_id, feature_key, classifier_version)`).
2. Subir la `classifier_version` no reescribe filas previas. Se crean nuevas filas con `review_status = draft`.
3. Al aprobar las nuevas filas, las anteriores con mismo `(book_id, feature_key)` pasan a `superseded` en la misma transacción.
4. El scoring usa la fila `approved` con mayor `classifier_version` activa.
5. Las razones de la nueva versión quedan en `book_classification_audit` con `actor_role = system` y `reason = classifier_version_bump`.
6. Migraciones de taxonomía (añadir/eliminar `book_feature_key`) son cambios de `classifier_version` mayor y requieren migración con dataset histórico (ver §16).

---

## 12. Separación obra vs edición

### 12.1 `books` (obra abstracta)

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `title` | text NOT NULL | Título canónico |
| `original_language` | varchar(8) BCP-47 | Idioma original |
| `original_year` | integer nullable | Año de publicación original |
| `canonical_edition_id` | UUID nullable | Edición de referencia para metadata |
| `series_id` | UUID nullable FK | Pertenece a una saga/serie (ver §12.1b) |
| `series_position` | integer nullable | Posición dentro de la serie (1-indexed) |
| `series_membership` | enum | `standalone`, `series_member`, `series_first`, `series_middle`, `series_last`, `anthology_contributor` |
| `work_status` | enum | `active`, `merged`, `deprecated` |
| `merged_into` | UUID nullable FK | Para deduplicación |
| `optimistic_lock_version` | integer | Para actualización concurrente |
| `created_at`, `updated_at` | timestamptz | |

#### 12.1a `authors`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `canonical_name` | text NOT NULL | Nombre canónico |
| `alternate_names_json` | JSONB NOT NULL default `[]` | aliases |
| `country_code` | varchar(2) nullable | ISO 3166-1 alpha-2 |
| `language_code` | varchar(8) nullable | BCP-47, idioma materno |
| `optimistic_lock_version` | integer NOT NULL default 0 | |
| `created_at`, `updated_at` | timestamptz | |

#### 12.1b `series`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `title` | text NOT NULL | Nombre de la saga |
| `total_volumes` | integer nullable | Total conocido; null si abierto |
| `is_completed` | boolean default false | Si la saga está cerrada |
| `created_at`, `updated_at` | timestamptz | |

#### 12.1c `book_authors`

| Columna | Tipo | Notas |
|---|---|---|
| `book_id` | UUID FK | |
| `author_id` | UUID FK | |
| `role` | enum | `primary`, `co_author`, `translator_preface`, `contributor`, `editor` |
| `order` | integer NOT NULL | Orden de aparición |
| `created_at` | timestamptz | |

PK compuesta: `(book_id, author_id, role)`. Soporta co-autoría y roles múltiples.

### 12.2 `book_features` (en la obra)

Definición de tabla:

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `book_id` | UUID FK |
| `feature_key` | varchar(100) NOT NULL | claves del catálogo §3; validar contra catálogo activo |
| `value` | numeric(5,4) nullable |
| `confidence` | numeric(5,4) NOT NULL default 0 |
| `classifier_version` | varchar(30) NOT NULL |
| `classification_identity` | UUID NOT NULL |
| `source_support_json` | JSONB NOT NULL |
| `review_status` | enum NOT NULL default `draft` |
| `is_scoring_aux` | boolean default false |
| `review_actor_id` | UUID nullable |
| `reviewed_at` | timestamptz nullable |
| `created_at`, `updated_at` | timestamptz |
| `optimistic_lock_version` | integer NOT NULL default 0 |

Restricciones:

```sql
CHECK (value IS NULL OR value BETWEEN 0 AND 1);
CHECK (confidence BETWEEN 0 AND 0.95);
UNIQUE (book_id, feature_key, classifier_version);
```

### 12.3 Features dependientes de edición

Sólo estas features pueden variar por edición y se guardan en `book_editions.edition_overrides_json`:

- `linguistic_complexity` (traducción puede cambiar el nivel)
- `style_clarity` (traducción cambia claridad)
- `pages` (campo dedicado)
- `audio_minutes` (campo dedicado)

Cuando hay `edition_overrides_json`, el scoring usa el override si la request selecciona esa edición. El override se persiste con la misma estructura de `source_support_json` + `review_status`.

---

## 13. Tabla `book_editions`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `book_id` | UUID FK NOT NULL | |
| `isbn_13` | varchar(13) nullable | unique parcial si no nulo |
| `isbn_10` | varchar(10) nullable | |
| `edition_label` | varchar | Ej: “1ª ed., trad. A. Pérez” |
| `format` | enum | `physical`, `ebook`, `audiobook` |
| `language` | varchar(8) BCP-47 NOT NULL | Idioma aplicado a la edición |
| `is_translation` | boolean NOT NULL default false | |
| `translator` | varchar nullable | |
| `publisher` | varchar nullable | |
| `pages` | integer nullable | |
| `audio_minutes` | integer nullable | Sólo si `format = audiobook` |
| `price` | numeric(10,2) nullable | |
| `currency` | char(3) nullable | ISO 4217 |
| `availability_status` | enum | `in_print`, `out_of_print`, `preorder`, `limited`, `discontinued` |
| `availability_regions` | varchar(2)[] | ISO 3166-1 alpha-2 |
| `published_at` | date nullable | Fecha publicación de la edición |
| `source` | varchar | Origen del registro de edición |
| `edition_overrides_json` | JSONB | Ver §12.3 |
| `optimistic_lock_version` | integer NOT NULL default 0 | |
| `created_at`, `updated_at` | timestamptz | |

Restricciones:

```sql
CHECK (
  (format = 'audiobook' AND audio_minutes IS NOT NULL)
  OR (format <> 'audiobook' AND pages IS NOT NULL)
);
CHECK (price IS NULL OR price >= 0);
CHECK (audio_minutes IS NULL OR audio_minutes > 0);
CHECK (pages IS NULL OR pages > 0);
```

Índices: `(book_id)`, `(format, language)`, `(isbn_13)` parcial, `(availability_status)`.

 Política de merge de ediciones: deduplica por `(isbn_13)` (si existe) o `(book_id, format, language, publisher, edition_label)` con hash. Resolverse vía script de curaduría.

---

## 14. Contratos JSON

### 14.1 `book_feature` (salida pública para scoring)

```json
{
  "book_id": "book_01J...",
  "feature_key": "hook_speed",
  "value": 0.70,
  "confidence": 0.78,
  "classifier_version": "book-tax/1.0",
  "review_status": "approved",
  "is_scoring_aux": false
}
```

### 14.2 `book_classification_attempt` (entrada del clasificador)

```json
{
  "book_id": "book_01J...",
  "feature_key": "hook_speed",
  "method": "narrative_analysis",
  "proposed_value": 0.70,
  "proposed_source_type": "ai_classification",
  "excerpt_ref": "book_01J.../sample/ch01#p1-12",
  "rationale": "Anzuelo explícito en la primera página",
  "model": "anthropic/claude-haiku",
  "prompt_version": "prompt/book-hook-speed/v1",
  "raw_output_ref": "audit_raw_01J..."
}
```

El backend:

1. Valida contra JSON Schema (claves permitidas, rango `0..1`, `excerpt_ref` obligatorio si la fuente cita texto).
2. Carga todas las contribuciones existentes para esa `(book_id, feature_key)`.
3. Recalcula `consensus_value`, `source_variance`, `confidence`.
4. Persiste `book_features` y `book_classification_audit`.

### 14.3 `classification_review_action`

```json
{
  "book_feature_id": "bf_01J...",
  "review_action": "confirm_consensus",
  "review_action_reason": "Consenso plausible, fuente IA apoyada por reseña",
  "curator_value": null,
  "actor_id": "usr_01J...",
  "discarded_source_ids": []
}
```

### 14.4 `book_work` (resumen)

```json
{
  "book_id": "book_01J...",
  "title": "Eligh",
  "original_language": "es-MX",
  "original_year": 2023,
  "author_ids": ["usr_01J..."],
  "series_id": null,
  "series_position": null,
  "series_membership": "standalone",
  "canonical_edition_id": "ed_01J...",
  "editions_count": 2,
  "scoring_minimum_coverage": 1.00,
  "feature_coverage_ratio": 0.94,
  "is_candidate_ready": true
}
```

---

## 15. Pruebas de aceptación

1. **Sin clasificación**: un libro sin filas en `book_features` tiene `feature_coverage_ratio = 0` (sobre `scoring_required_minimum`), `is_candidate_ready = false`.
2. **Cap IA**: una feature con única fuente `ai_classification` produce `confidence <= 0.40`.
3. **Voto múltiple**: dos reseñas + IA con `value = 0.70` y `0.65` producen `confidence > 0.40`.
4. **Discrepancia**: dos fuentes con `|value_i − value_j| > 0.20` marcan `review_status = needs_review`, no entran en scoring.
5. **Varianza alta**: `source_variance >= 0.10` deja la feature en `value = null`, `confidence = 0`.
6. **Override curador sin fuente**: `confidence = 0.60` y `review_action = override_curator_value`.
7. **Override curador alineado**: `|curator − consensus| <= 0.10` → `confidence = min(prev + 0.10, 0.95)`.
8. **Confidence < 0.20 en scoring_minimum**: la feature se trata como `null` para elegibilidad y scoring.
9. **Falta una `scoring_required_minimum`**: candidato bloqueado con `review_status = needs_classification`, no entra al ranking (reemplaza el viejo umbral 0.80).
10. **Todas `scoring_required_minimum` presentes**: candidato elegible aunque falten `core_optional` o `non_core`.
11. **Edición sin pages y sin audio_minutes**: viola CHECK; libro no entra a scoring por restricción hard.
12. **Supersede atómico**: al aprobar `classifier_version` nueva, las filas viejas pasan a `superseded` en la misma transacción y `optimistic_lock_version` cambia.
13. **Idempotencia IA**: la misma propuesta con el mismo `excerpt_ref` no crea dos contribuciones.
14. **Determinismo**: recalcular `consensus_value` con las mismas contribuciones y orden canónico produce el mismo número a 4 decimales.
15. **Series**: crear libro con `series_id` y `series_position = 2` es válido; candidato con `series_membership = series_middle` respeta el filtro de saga `first_in_series_only`.

---

## 16. Migración de taxonomía

- Añadir `book_feature_key` nuevos: bump `classifier_version` (p.ej. `book-tax/1.0` → `book-tax/1.1`). Libros viejos quedan con `null` en la nueva feature; no se reescribe la historia.
- Eliminar `book_feature_key`: marcar la definición `is_active = false` y `replacement_key`; las evidencias históricas se mantienen pero el scoring las ignora.
- Renombrar anclas semánticas: bump `classifier_version` y regenerar consenso si los anchors cambian la interpretación numérica (raro; documentar en `book_classification_audit.reason`).

---

## 17. Relación con otros documentos

- `reader_profile_spec.md` §13.13 define el mínimo de tablas de libro y `book_features`; este documento refina el contrato y los campos.
- `scoring_weights_spec.md` consume los `value` y `confidence` aquí definidos; ningún campo adicional se introduce fuera de este documento sin bump de versión.
- `tag_taxonomy_v1.md` gestiona los tags del libro; sus reglas de versión siguen el mismo patrón que §11 aquí.

---

## 18. No objetivos (MVP)

- Crawl automático de catálogos editoriales.
- Embeddings vectoriales (`pgvector`).
- Alineación semántica automática entre reseñas en distintos idiomas.
- Clasificación automática final sin revisión humana de features core.
- Inferencia de features desde la portada o el diseño.