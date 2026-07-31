# Especificación técnica: pesos, scoring y métricas de confianza agregada

**Documento:** `scoring_weights_spec.md`
**Versión:** `1.1.0`
**Estado:** complemento normativo de `reader_profile_spec.md` v1.1.1
**Audiencia:** backend, producto, curaduría editorial
**Escala interna canónica:** `NUMERIC(5,4)` en `0.0000..1.0000`
**Aritmética:** decimal estricta, orden canónico, redondeo único (ver §3)

## Changelog 1.1.0

- `numeric_fit_score`: nueva fórmula con `effective_weight = dimension_weight × reader_confidence × book_confidence`. La incertidumbre actúa como peso, no como multiplicador del compatibility, **una sola vez**.
- Elimina `coverage_adjustment` del producto con `numeric_fit_score`. La cobertura del lector queda como métrica diagnóstica (`profile_coverage`).
- Elimina `low_evidence_penalty` de `risk_penalty` para evitar doble cómputo de incertidumbre (ya reflejada en `effective_weight`).
- Elimina `tag_domain_weight = 0.15`. `domain_weight` y `dimension_weight` cubren sólo dominios numéricos 1–6 y suman exactamente `1`. Los tags participan únicamente vía `tag_fit_score` en la fórmula final.
- Mapeo `ideas`: ahora a `{6: 1.0}` sobre la nueva dimensión `conceptual_depth_appreciation` (espejo de `conceptual_depth` del libro).
- `null` sin imputación: en `goal_fit` y `emotion_fit`, features ausentes se excluyen del divisor; subscore `null` si todas ausentes. Si `requested_discovery_level` null → usar `reader.discovery_appetite` directo.
- Elimina `nonfiction_indicator`, `low_pages`, `atmospheric_indicator` (no definidas).
- Usa `available_energy` vía nuevo sub-score `effort_fit`. Usa `secondary_goals` en `goal_fit_combined`. Usa `author_novelty_indicator` en `discovery_fit_score`.
- `coverage_penalty` recibrada: penaliza `scoring_minimum_confidence_factor < 0.50` (no ya `feature_coverage_ratio`).
- Readiness: coverage y maturity son diagnosticas; los gates son completitud, minimum signal set y constraints operativas.
- `length_fit` / `reading_time_fit` por edición: audiobook usa `audio_minutes`.
- Ejemplo numérico recalculado. Agrega tabla diff v1.0 vs v1.1.

---

## 1. Objetivo

Eliminar todas las variables no definidas del `reader_profile_spec.md` §14 y reemplazar la noción monolítica de `overall_confidence` por un conjunto de métricas **agregadas y diagnósticas** que nunca sustituyen a la confianza individual de cada dimensión.

Define:

- `numeric_fit_score`, `tag_fit_score`, `context_fit_score`, `discovery_fit_score`
- `risk_penalty`
- `domain_weight` y `dimension_weight`
- mapeo `priority_vector` → dominios
- tratamiento de `reader_value = null` y `book_value = null`
- confianza mínima admisible
- reglas bloqueantes vs penalizadoras
- persistencia de cada componente
- métricas agregadas: `onboarding_core_coverage`, `global_profile_coverage`, `evidence_maturity`, `recommendation_evidence_coverage`
- reglas de determinismo y pruebas

---

## 2. Convenciones

1. Toda operación aritmética se hace en `NUMERIC(10,4)` (backend) o equivalente decimal con escala 4 — nunca coma flotante binaria.
2. Toda salida persistible se redondea con `HALF_UP` a 4 decimales, **una sola vez**, al finalizar el cálculo de cada componente.
3. Las sumas se acumulan en un orden canónico: claves (`dimension_key`, `tag_key`, `aspect_key`) en orden lexicográfico ascendente.
4. Ninguna operación intermedia redondea.
5. `null` ≠ `0`, salvo cuando se documenta explícitamente.
6. Toda confianza está acotada a `[0, 0.95]` individualmente; los scores finales a `[0,1]`.

---

## 3. Aritmética decimal y determinismo

- Backend debe usar decimal fijo o `BigDecimal`/`Decimal.js`. No usar `number` IEEE-754.
- Orden canónico de acumulación: `dimension_key` asc, luego `tag_key` asc, luego `aspect_key` asc.
- Tolerancia de igualdad en pruebas: `abs(a − b) <= 0.0001`.
- Recomputación idempotente: mismo conjunto de evidencia + misma `calculation_version` + misma `classifier_version` + mismo `prompt_version` → snapshots idénticos dentro de la tolerancia.

---

## 4. `domain_weight` y `dimension_weight`

### 4.1 Mapeo `priority_vector` → dominios

`priority_vector` proviene de `Q03_PRIORITY_RANKING` y expresa la importancia relativa de seis *factores* (`plot`, `characters`, `ideas`, `atmosphere`, `style`, `emotion`). Cada factor se reparte entre uno o más dominios del lector mediante una **tabla de alocación cerrada**:

| Factor | Alocación |
|---|---|
| `plot` | `{1: 0.6, 2: 0.4}` |
| `characters` | `{3: 1.0}` |
| `ideas` | `{6: 1.0}` sobre `conceptual_depth_appreciation` |
| `atmosphere` | `{5: 0.5, 4: 0.5}` |
| `style` | `{4: 1.0}` |
| `emotion` | `{5: 1.0}` |

Donde `1..6` son los dominios numéricos del lector (`tracción`, `estructura`, `personajes`, `estilo`, `emoción`, `cognitivo`). Los dominios 7 (tags), 8 (restricciones), 9 (descubrimiento) y 10 (contexto) **no reciben `domain_weight`**:

- 7 participa vía `tag_fit_score` en la fórmula final (§5.3).
- 8 se trata por filtros duros (§7.1).
- 9 entra vía `discovery_fit_score` (§5.5).
- 10 entra vía `context_fit_score` (§5.4).

El mapeo `ideas → {6: 1.0}` se aplica **únicamente** a la dimensión `conceptual_depth_appreciation` (espejo de `conceptual_depth` del libro). No infla el peso de `linguistic_complexity_tolerance`, `cast_size_tolerance` ni `sustained_attention_tolerance`; son dimensiones independientes del dominio 6.

### 4.2 Cálculo de `domain_weight`

1. `raw_domain_weight[d] = Σ_factor priority_vector[factor] × allocation[factor][d]`, con `d ∈ {1..6}`.
2. Sumar un peso base `0.10` fijo por dominio para evitar dominios con peso cero cuando el lector no priorizó ese factor pero sí tiene dimensiones activas:
   `effective_raw[d] = raw_domain_weight[d] + 0.10`.
3. `domain_weight[d] = effective_raw[d] / Σ_d' effective_raw[d']` → normalizado a `Σ_d domain_weight[d] = 1.0000`.

No se reserva peso para tags. Las tags no usan `domain_weight`.

### 4.3 `dimension_weight`

Para cada `dimension_key` perteneciente al dominio `d`:

```text
dimension_weight[dim] = domain_weight[d] / active_dim_count_in_domain(d)
```

Donde `active_dim_count_in_domain(d)` es el número de dimensiones del dominio `d` que:

- pertenecen a los dominios 1–6 (no es tag, no es restricción);
- tienen `reader_value != null` y `reader_confidence >= 0.15`;
- tienen `book_value != null` y `book_confidence >= 0.20`.

Ajustes:

- Un dominio `d` con `active_dim_count_in_domain(d) = 0` redirige su `domain_weight[d]` proporcionalmente a los demás dominios activos. Si ningún dominio tiene dimensiones activas, el candidato queda bloqueado (§7.1).
- Sólo se consideran activas las dimensiones que también estén presentes en el libro (`book_value != null` con confianza suficiente). Si una dimensión no está en el libro, no cuenta como activa ni contribuye.

`Σ dimension_weight = 1.0000` sobre todas las dimensiones activas elegibles.

---

## 5. Componentes del scoring

### 5.1 `numeric_fit_score`

```text
eligible_dims = {
  dim ∈ all_dims
  : reader_value[dim] != null
  AND reader_confidence[dim] >= 0.15
  AND book_value[dim] != null
  AND book_confidence[dim] >= 0.20
  AND dimension_weight[dim] > 0
}

compatible(dim) = per matching_operator (espejo del spec §14.2), clamp 0..1

effective_weight[dim] = dimension_weight[dim] × reader_confidence[dim] × book_confidence[dim]

Σ_EW = Σ_dim eligible effective_weight[dim]
Σ_EWC = Σ_dim eligible effective_weight[dim] × compatible(dim)

numeric_fit_score = Σ_EWC / Σ_EW      si Σ_EW > 0
                  = null              si Σ_EW = 0
```

- `numeric_fit_score ∈ [0,1]`, porque `compatible ∈ [0,1]` y `effective_weight >= 0`.
- La incertidumbre (`reader_confidence` y `book_confidence`) actúa **una sola vez**: como peso. No hay `coverage_adjustment` multiplicador adicional; no hay `low_evidence_penalty` que recomponga la misma incertidumbre (ver §5.6).
- Si `Σ_EW = 0` → candidato bloqueado (§7.1).
- Orden canónico por `dimension_key` asc.

`numeric_fit_score` es lo que entra a la fórmula final. **No** existe `numeric_fit_score_final` distinto: el nombre `numeric_fit_score_final` se conserva como alias de retrocompatibilidad en persistencia (§8) pero **vale lo mismo que `numeric_fit_score`**.

### 5.2 Coverage del lector — sólo diagnóstica

`coverage_ratio` ya no modifica `numeric_fit_score`. Se conserva como insumo de `recommendation_evidence_coverage` (§10.3) y `global_profile_coverage` (§10.1):

```text
active_reader_dims = count(dim : reader_value[dim] != null AND reader_confidence >= 0.15)
coverage_ratio = count(eligible_dims) / max(1, active_reader_dims)   # rango [0,1], sólo diagnóstico
```

No hay regla bloqueante por `coverage_ratio`. El bloqueo por ausencia de eligible dims se captura en §5.1 (`Σ_EW = 0`).

### 5.3 `tag_fit_score`

Para `t` en la intersección de las preferencias de tags del lector (con `affinity != null`) y los tags del libro (con `book_tag_strength != null`):

```text
raw = Σ_t user_affinity[t] × book_tag_strength[t] × user_confidence[t]      # orden tag_key asc
scale = Σ_t |user_affinity[t]|                                              # sobre todos los tags del usuario con affinity != null
tag_fit_score_signed = raw / scale                                          # rango aprox [-1, 1]
tag_fit_score = (tag_fit_score_signed + 1) / 2                              # rango [0, 1], neutro 0.50
```

Casos:

- `scale = 0` (usuario sin tags con affinity != 0) → `tag_fit_score = null`, se redistribuye peso (ver §7.3).
- Hacer coincidir tags sólo sobre el mismo `tag_type`. Distintos `tag_type` no se cruzan.
- Las etiquetas `deprecated` con `replacement_tag_key` se sustituyen antes del match (ver `tag_taxonomy_v1.md` §8). Las `deprecated` sin reemplazo se ignoran.
- Escalas: `book_tag_strength ∈ [0, 1]` (no negativa; 0 = el libro no exhibe ese tag), `user_affinity ∈ [-1, 1]` (negativa = evita; 0 = neutral/desconocido). Hoy `tag_fit_score_signed` puede ser negativo si hay tags evitados coincidentes con affinity negativa del lector y `book_tag_strength > 0`.
- **No hay herencia automática por `parent_tag_key`**: si el usuario prefiere `thriller` y el libro sólo tiene `psychological_thriller`, no se transfiere la afinidad sin un match explícito (ver `tag_taxonomy_v1.md` §8).

### 5.4 `context_fit_score`

Compuesto por cinco sub-scores, cada uno en `[0,1]` salvo los explícitamente `null`:

#### 5.4.1 `length_fit`

Usa `reader.constraints.preferred_pages` (rango `{min, max}`) y la **edición seleccionada** del libro. La unidad depende del formato:

- `format ∈ {physical, ebook}`: usa `book_edition.pages`.
- `format = audiobook`: usa `book_edition.audio_minutes` y los `preferred_minutes` (de request o perfil). Si la request define tanto `preferred_max_pages` como `preferred_max_minutes`, se usa el apropiado al formato.

```text
if format = audiobook:
    metric = audio_minutes ; max_metric = max_minutes ; min_metric = min_minutes
else:
    metric = pages ; max_metric = max_pages ; min_metric = min_pages

if metric >= min_metric AND metric <= max_metric:
  length_fit = 1.0
elif metric < min_metric:
  length_fit = clamp(1 - (min_metric - metric) / max(1, min_metric), 0, 1)
else:  # metric > max_metric
  length_fit = clamp(1 - (metric - max_metric) / max(1, max_metric), 0, 1)
```

Si la request trae `preferred_max_pages`/`preferred_max_minutes` explícito, se usa el menor entre el `max` del perfil y el de la request, en la unidad apropiada al formato.

Si la edición elegida no aporta el campo necesario (`pages` para físico/ebook, `audio_minutes` para audiolibro) → `length_fit = null` y se redistribuye su peso.

#### 5.4.2 `reading_time_fit`

Usa `reading_request.reading_time_minutes_per_week` (`R`) y la edición. Para físico/ebook: ritmo nominal `250 palabras/página` a `200 ppm` ⇒ `pages_per_week = R × 200 / 250`. Para audiolibro: `minutes_per_week = R` directo.

```text
if format = audiobook:
    weeks_needed = audio_minutes / max(1, R)        # R es min/semana
else:
    pages_per_week = R * 200 / 250
    weeks_needed = pages / max(1, pages_per_week)

# neutro si se termina en 0–6 semanas; penaliza lineal si >6, clamp 0
reading_time_fit = clamp(1 - max(0, weeks_needed - 6) / 6, 0, 1)
```

Si `R` es `null` → `reading_time_fit = null` y se redistribuye su peso dentro de `context_fit_score` (ver §5.4.6).

#### 5.4.3 `goal_fit`

`primary_goal` se mapea a un perfil esperado de features del libro (vector `expected`). Sólo se usan features definidas en `book_taxonomy_spec.md` §3. **No** se inventan helpers como `nonfiction_indicator`, `low_pages`, `atmospheric_indicator` — no existen en el catálogo.

| `primary_goal` | Features esperadas (con `target_f`) |
|---|---|
| `disconnect` | `comfort_level` (t 1.0), `attention_demand` (t 0.25) |
| `leave_reading_slump` | `hook_speed` (t 1.0), `narrative_payoff` (t 1.0), `attention_demand` (t 0.3) |
| `learn` | `conceptual_depth` (t 0.8), `conceptual_density` (t 0.7) |
| `feel_tension` | `tension_level` (t 1.0), `emotional_intensity` (t 1.0) |
| `comfort` | `comfort_level` (t 1.0), `hope_level` (t 1.0) |
| `catharsis` | `emotional_intensity` (t 1.0), `sadness_level` (t 0.7), `narrative_payoff` (t 1.0) |
| `challenge` | `linguistic_complexity` (t 1.0), `structural_complexity` (t 1.0), `conceptual_depth` (t 0.8) |
| `short_read` | `length_fit` ya recoge esto (vía `length_fit`); `goal_fit` aquí se computa sobre `narrative_pace` (t 0.7, lectura ágil) y `event_density` (t 0.7) |
| `immersion` | `worldbuilding_load` (t 0.7), `descriptive_density` (t 0.8), `strangeness_level` (t 0.6) |
| `discovery` | manejado por `discovery_fit_score`; aquí `goal_fit = null` (se redistribuye peso) |

Operación para cada feature esperada `f` (con target `target_f`): `compatible_target = 1 - abs(book_value[f] - target_f)` (clamp `0..1`). **Features ausentes se excluyen del divisor; no se imputa `0.5`**. Si `desired_emotions` o las features para el `primary_goal` están todas ausentes → subscore `null`.

```text
present = [(f, target_f) for (f, target_f) in expected if book_value[f] != null AND book_confidence[f] >= 0.20]
if count(present) == 0:
  goal_fit_primary = null
else:
  goal_fit_primary = average( (1 - abs(book_value[f] - target_f)) for (f, target_f) in present )
```

#### 5.4.4 `secondary_goals[]`

`reading_request.secondary_goals[]` (opcional) se compone con el `primary_goal`:

```text
if secondary_goals is empty:
  goal_fit = goal_fit_primary
else:
  secondary_fits = [ goal_fit_for_goal(g) for g in secondary_goals ]
  secondary_fits = [v for v in secondary_fits if v is not null]
  if secondary_fits is empty:
    goal_fit = goal_fit_primary
  elif goal_fit_primary is null:
    goal_fit = average(secondary_fits)
  else:
    goal_fit = 0.7 × goal_fit_primary + 0.3 × average(secondary_fits)
```

Si ambos (`goal_fit_primary` y todos los `secondary`) son `null` → `goal_fit = null`.

#### 5.4.5 `emotion_fit`

Para cada `desired_emotion` en la request, mapping a features emocionales del libro:

| `desired_emotion` | Features consultadas (con `target_f`) |
|---|---|
| `tension` | `tension_level` (t 1.0), `emotional_intensity` (t 1.0) |
| `curiosity` | `ambiguity` (t 0.6), `tension_level` (t 0.6) |
| `fun` | `humor_level` (t 1.0) |
| `comfort` | `comfort_level` (t 1.0), `hope_level` (t 1.0) |
| `sadness` | `sadness_level` (t 1.0), `emotional_intensity` (t 0.8) |
| `wonder` | `strangeness_level` (t 1.0), `worldbuilding_load` (t 0.7) |
| `discomfort` | `darkness_level` (t 0.8), `emotional_intensity` (t 0.8) |
| `hope` | `hope_level` (t 1.0), `comfort_level` (t 0.7) |
| `reflection` | `introspection_density` (t 0.7), `conceptual_depth` (t 0.6) |

Por emoción: promedio sobre features **presentes** (sin imputar `0.5`); si ninguna feature presente, esa emoción se omite. Promedio final sobre emociones con al menos una feature presente. Si `desired_emotions` vacío o todas ausentes → `emotion_fit = null`.

```text
per_emotion_fits = []
for emotion in desired_emotions:
    present = [f for f in features_by_emotion[emotion]
               if book_value[f] != null AND book_confidence[f] >= 0.20]
    if present is not empty:
        per_emotion_fits.append( average(1 - abs(book_value[f] - target_f) for f in present) )
emotion_fit = average(per_emotion_fits)          # si vacío → null
```

#### 5.4.6 `effort_fit` (usa `available_energy`)

`reading_request.available_energy ∈ [0,1]` modula la tolerancia a exigencia cognitiva del libro. Define el techo de exigencia admisible:

```text
effort_upper = 0.40 + 0.60 × available_energy     # 0.40 si energy=0, 1.00 si energy=1
book_effort_load = max(
    book_value["attention_demand"]      if present else 0,
    book_value["linguistic_complexity"] if present else 0,
    book_value["structural_complexity"] if present else 0,
) * 0.5 + 0.5 * max(
    book_value["conceptual_density"]    if present else 0,
    book_value["worldbuilding_load"]     if present else 0,
)                                                   # agregado de exigencia, 0..1
if book_effort_load <= effort_upper:
    effort_fit = 1.0
else:
    effort_fit = clamp(1 - (book_effort_load - effort_upper) / 0.60, 0, 1)
```

Si `available_energy` es `null` → `effort_fit = null` y se redistribuye su peso (§5.4.7).

#### 5.4.7 Composición de `context_fit_score`

```text
context_weights = {
  length_fit:        0.25,
  reading_time_fit:  0.20,
  goal_fit:          0.25,
  emotion_fit:       0.15,
  effort_fit:        0.15
}
```

Si un sub-score es `null`, su peso se redistribuye entre los demás sub-scores **no nulos** proporcionalmente. Si todos quedan `null` → `context_fit_score = null` y su peso en `final_score` se redistribuye (§7.3).

```text
context_fit_score = Σ_k context_weights[k] × sub_score[k]   # tras redistribución
```

### 5.5 `discovery_fit_score`

Usa `available_energy`'s sibling `requested_discovery_level` (opcional) y `available_energy`'s sibling `discovery_appetite`:

```text
if reading_request.requested_discovery_level != null:
    effective_appetite = reading_request.requested_discovery_level
else:
    effective_appetite = reader.discovery_appetite           # no se inventa 0.5

# book_discovery_profile combina popularidad + novedad del autor (ambas auxiliares en book_taxonomy_spec §3.2)
popularity_term  = book_features["popularity_score"]         # 0..1
novelty_term      = book_features["author_novelty_indicator"] # 0..1

if popularity_term is null AND novelty_term is null:
    book_discovery_profile = null
elif popularity_term is null:
    book_discovery_profile = novelty_term                     # usa sólo novedad
elif novelty_term is null:
    book_discovery_profile = 1 - popularity_term              # usa sólo popularidad invertida
else:
    book_discovery_profile = 0.5 × (1 - popularity_term) + 0.5 × novelty_term

if book_discovery_profile is null:
    discovery_fit_score = null
else:
    discovery_fit_score = clamp(1 - abs(book_discovery_profile - effective_appetite), 0, 1)
```

Casos:

- Si `reader.discovery_appetite` es la única dimensión del dominio 9 con valor (lo normal en MVP), se usa únicamente esa como `effective_appetite` cuando la request trae `requested_discovery_level = null`.
- Si `popularity_score` Y `author_novelty_indicator` son ambos `null` → `book_discovery_profile = null` → `discovery_fit_score = null` → redistribución (§7.3).

### 5.6 `risk_penalty`

Compuesto por dos términos permanentes + reglas condicionales, cada uno ≥ 0; `risk_penalty` se clamp a `[0, 0.40]`:

#### 5.6.1 `coverage_penalty` (sobre confianza, no ratio)

Penaliza cuando la confianza promedio de las `scoring_required_minimum` (10 features) baja de `0.50`. **No** usa `feature_coverage_ratio` para evitar recomponer la incertidumbre que ya está en `effective_weight`:

```text
scoring_minimum_active = {
    f ∈ scoring_required_minimum
    : book_value[f] != null AND book_confidence[f] >= 0.20
}
scoring_minimum_confidence_factor = average(book_confidence[f] for f in scoring_minimum_active)
coverage_penalty = max(0, 0.50 - scoring_minimum_confidence_factor) × 0.50   # rango [0, 0.25]
```

Casos:

- Las `scoring_required_minimum` faltantes ya bloquean al candidato por el gate del `book_taxonomy_spec.md` §9.2.1; aquí todas están presentes (por construcción del candidato admitido).
- Para un candidato plenamente clasificado con confianza alta (>=0.50 avg) ⇒ `coverage_penalty = 0`. Documentado: la penalización es cero por diseño para candidatos bien clasificados.
- Si `scoring_minimum_active` está vacío (no debería llegado a este punto) ⇒ `coverage_penalty = 0.25` (máximo del término).

#### 5.6.2 `soft_aversion_penalty`

Por cada coincidencia de una `soft_aversion_key` del catálogo (ver `reader_profile_spec.md` §27.x — `soft_aversion_definitions`) con una condición sobre features/tags del libro que se materializa, aplica una penalización basada en la confianza del lector sobre esa aversión:

```text
soft_aversion_penalty = Σ_i match_factor_i × 0.08 × reader_confidence_i        # cap 0.20
```

Donde `match_factor_i ∈ {0, 1}` evalúa la `condition_json` de la `soft_aversion` contra las features/tags del libro (operadores `{gte, lte, gt, lt, eq, neq}` sobre `book_feature_key` o `tag_key`). El cap de `0.20` se aplica después de sumar.

#### 5.6.3 Reglas condicionales (`conditional_rule_penalty`)

Las reglas condicionales activas con `effect = penalty` (ver `reader_profile_spec.md` §9.7 y §15.4 para el JSON Schema) añaden su `penalty_amount` a `risk_penalty`:

```text
conditional_rule_penalty = Σ_r active_penalty_rules r.penalty_amount     # cáps por regla: 0.05
```

#### 5.6.4 Acumulación

```text
risk_penalty = clamp(
  coverage_penalty + soft_aversion_penalty + conditional_rule_penalty,
  0, 0.40
)
```

Desglose completo persistido en `recommendation_candidates.risk_penalty_breakdown_json` (§8).

> **Eliminado en 1.1.0**: `low_evidence_penalty`. La incertidumbre del libro ya penaliza vía `effective_weight` en `numeric_fit_score` (5.1). Duplicar la penalización por confianza baja habría sido doble cómputo.

---

## 6. Confianza mínima admisible

Umbral inferior de evidencia para entrada en scoring:

- `reader_confidence >= 0.15` — ver §5.1.
- `book_confidence  >= 0.20` — más estricto porque el libro se clasifica una sola vez por versión.
- `evidence_maturity` (§10.x) del perfil por debajo de `0.10` no impide el scoring pero produce `recommendation_evidence_coverage` muy bajo (alerta curador).
- Para features `scoring_required_minimum`: `book_confidence >= 0.20` Y `review_status = approved` (gate hardware del `book_taxonomy_spec.md` §9.2.1).

---

## 7. Reglas bloqueantes vs penalizadoras y fórmula final

### 7.1 Bloqueantes (candidato persistido con `review_status = blocked`)

- Filtros duros (`reader_profile_spec.md` §14.1).
- `numeric_fit_score = null` (`Σ_EW = 0`, §5.1).
- Regla condicional activa con `effect = block` (ver `reader_profile_spec.md` §9.7 y `conditional_rules` JSON Schema en §26.x).
- Falta de `scoring_required_minimum` features (candidato queda `needs_classification`, `book_taxonomy_spec.md` §9.2.1).

Los candidatos bloqueados **sí se persisten** en `recommendation_candidates` con `review_status = blocked` y `block_reason`, para auditoría y ML futuro (`reader_profile_spec.md` §20).

### 7.2 Penalizadoras

- `risk_penalty` y sus sub-términos (`coverage_penalty`, `soft_aversion_penalty`, `conditional_rule_penalty`).
- Regla condicional activa con `effect = penalty` se incluye dentro de `conditional_rule_penalty` (§5.6.3).

### 7.3 `final_score`

```text
final_score =
    0.50 × numeric_fit_score
  + 0.20 × tag_fit_score
  + 0.20 × context_fit_score
  + 0.10 × discovery_fit_score
  - risk_penalty

final_score = clamp(final_score, 0, 1)
```

Redistribución si un componente es `null`:

| Componente `null` | Redistribución |
|---|---|
| `tag_fit_score = null` | pesos → `numeric: 0.625, context: 0.25, discovery: 0.125` |
| `context_fit_score = null` | pesos → `numeric: 0.625, tag: 0.25, discovery: 0.125` |
| `discovery_fit_score = null` | pesos → `numeric: 0.5556, tag: 0.2222, context: 0.2222` (preserva ratio 0.5:0.2:0.2) |
| dos o más `null` | reescalar proporcionalmente los pesos no nulos restantes a `Σ = 1` (sin redistribuir al componente `null`); documentar caso |

Los pesos redistribuidos se guardan en `recommendation_candidates.weight_distribution_json`.

---

## 8. Persistencia de componentes

`recommendation_candidates` debe incluir (extiende `reader_profile_spec.md` §13.14):

| Columna | Tipo |
|---|---|
| `numeric_fit_score` | numeric(5,4) nullable |
| `numeric_fit_score_final` | numeric(5,4) nullable | (alias de `numeric_fit_score`; no se multiplica por `coverage_adjustment` en 1.1) |
| `coverage_ratio` | numeric(5,4) | diagnóstica, sobre lector |
| `tag_fit_score` | numeric(5,4) nullable |
| `tag_fit_raw` | numeric(8,4) |
| `tag_fit_scale` | numeric(8,4) |
| `context_fit_score` | numeric(5,4) nullable |
| `context_length_fit` | numeric(5,4) nullable |
| `context_reading_time_fit` | numeric(5,4) nullable |
| `context_goal_fit` | numeric(5,4) nullable |
| `context_emotion_fit` | numeric(5,4) nullable |
| `context_effort_fit` | numeric(5,4) nullable | new en 1.1 |
| `discovery_fit_score` | numeric(5,4) nullable |
| `effective_appetite` | numeric(5,4) nullable |
| `book_discovery_profile` | numeric(5,4) nullable |
| `scoring_minimum_confidence_factor` | numeric(5,4) |
| `risk_penalty` | numeric(5,4) |
| `risk_penalty_breakdown_json` | JSONB |
| `final_score` | numeric(5,4) |
| `candidate_score` | numeric(5,4) | (alias de `final_score` en MVP; permite ranking futuro distinto) |
| `weight_distribution_json` | JSONB |
| `evaluation_meta_json` | JSONB | (`calculation_version`, `classifier_version`, `tag_taxonomy_version`, `prompt_version`, `evidence_set_hash`, timestamp) |

`risk_penalty_breakdown_json` ejemplo:

```json
{
  "coverage_penalty": 0.000,
  "soft_aversion_penalty": 0.040,
  "conditional_rule_penalties": [
    { "rule_key": "slow_burn_requires_tension", "penalty": 0.030 }
  ],
  "total": 0.070
}
```

(En 1.1 `coverage_penalty` puede ser cero por diseño cuando el candidato está plenamente clasificado con confianza alta; no es un bug.)

---

## 9. Tratamiento explícito de `null`

### 9.1 `reader_value = null`

- No entra como `eligible_dim`. No contribuye a `numeric_fit_score` ni a `coverage_ratio` (denominador).
- No acumula penalización.
- Disminuye `coverage_ratio` (métrica diagnóstica) ⇒ reflejado en `recommendation_evidence_coverage`.
- Si todas las dimensiones del lector son `null` ⇒ `Σ_EW = 0` ⇒ `numeric_fit_score = null` ⇒ candidato bloqueado (§7.1).

### 9.2 `book_value = null`

- No entra como `eligible_dim`. No contribuye, no penaliza, **no se imputa `0.5`**.
- En sub-scores de `context_fit_score` (`goal_fit`, `emotion_fit`, `effort_fit`): una feature `null` se **excluye** del divisor. Si todas las features esperadas para ese sub-score están ausentes → el sub-score es `null` (activa redistribución interna de `context_fit_score` en §5.4.7).
- En `scoring_required_minimum`: faltante ⇒ bloqueo por gate (`book_taxonomy_spec.md` §9.2.1).
- En `coverage_penalty`: entra vía `scoring_minimum_confidence_factor` calculado sólo sobre las presentes activas (§5.6.1).

### 9.3 Componente `null` (tag/context/discovery/sub-score)

- `tag_fit_score = null`, `context_fit_score = null`, `discovery_fit_score = null` ⇒ redistribución de pesos en `final_score` según §7.3.
- Sub-scores de contexto `null` (length/reading_time/goal/emotion/effort) ⇒ redistribución interna de `context_fit_score` según §5.4.7.
- `requested_discovery_level = null` **no** es un componente `null`: se sustituye por `reader.discovery_appetite` sin activar redistribución.
- Persistir `null` explícito; nunca `0`.

---

## 10. Métricas de confianza y readiness agregadas

Estas métricas **no** sustituyen a `dimension.confidence`. Viven como campos diagnósticos en `reader_profiles` y en cada `recommendation_candidates`. Son insumo para el panel del curador y para alertas de calidad de datos, no para el score.

### 10.1 `global_profile_coverage` (en `reader_profiles`, diagnóstica)

```text
relevant_dims = 43 active profile keys (39 numeric dimensions + 4 discovery selection controls)
global_profile_coverage = count(dim : value != null AND confidence >= 0.15) / relevant_dims
```

Rango `[0,1]`. **Diagnóstica**, no gate.

### 10.2 `onboarding_core_coverage` (en `reader_profiles`, diagnostica)

Define `onboarding_core_dimensions` — conjunto cerrado de 12 dimensiones cubiertas por preguntas obligatorias del cuestionario inicial (ver `reader_profile_spec.md` §6.x y §26.6):

```
hook_need, pace_preference, open_ending_tolerance,
character_depth_need, moral_ambiguity_tolerance, distinct_voice_need,
style_clarity_preference, ornate_prose_tolerance,
tension_preference, comfort_preference,
linguistic_complexity_tolerance, conceptual_depth_appreciation
```

```text
onboarding_core_coverage = count(dim : dim ∈ onboarding_core_dimensions
                                  AND value[dim] != null
                                  AND confidence[dim] >= 0.15) / 12
```

Rango `[0,1]`. Es diagnostica; no participa en `ready_to_recommend` (ver §10.6).

### 10.3 `evidence_maturity` (en `reader_profiles`)

```text
total_weight = Σ_dim reader.total_evidence_weight[dim]          # todas las dims, orden dim asc
evidence_maturity = clamp(1 - exp(-total_weight / 30.0), 0, 0.95)
```

Refleja cuánta evidencia acumulada (de cualquier tipo) sostiene el perfil. Crecimiento asintótico al `0.95`. Diagnóstica.

### 10.4 `recommendation_evidence_coverage` (en cada `recommendation_candidates`)

Fracción de componentes del scoring **alimentados con evidencia real** (no `null`, no redistribución automática):

```text
components = [
  numeric_fit_score        (1 si not null else 0),
  tag_fit_score            (1 si not null else 0),
  context_length_fit       (1 si not null else 0),
  context_reading_time_fit (1 si not null else 0),
  context_goal_fit         (1 si not null else 0),
  context_emotion_fit      (1 si not null else 0),
  context_effort_fit       (1 si not null else 0),
  discovery_fit_score      (1 si not null else 0)
]
recommendation_evidence_coverage = sum(components) / 8
```

`recommendation_evidence_coverage < 0.45` → el curador recibe alerta visible: “selección con baja cobertura de evidencia”.

### 10.5 `overall_confidence_legacy`

Se mantiene como campo computado *(legacy alias)* para retrocompatibilidad durante migración controlada:

```text
overall_confidence_legacy = clamp(
  0.5 × onboarding_core_coverage + 0.5 × evidence_maturity,
  0, 0.95
)
```

Se elimina en `profiles-schema/2.0`.

### 10.6 `ready_to_recommend` (en `reader_profiles`)

```text
ready_to_recommend =
    required_questions_complete (ver reader_profile_spec §26.6)
  AND questionnaire_session_completed
  AND minimum_signal_set_satisfied
  AND operational_constraints_complete
```

### 10.7 Invariante

```text
∀dim: dimension.confidence[dim]  es independiente de las cinco métricas agregadas
       (global_profile_coverage, onboarding_core_coverage, evidence_maturity,
        recommendation_evidence_coverage, overall_confidence_legacy).
Ningún cálculo del score usa ninguna de ellas.
```

---

## 11. Ejemplo completo con números (recalculado 1.1)

### 11.1 Datos de entrada

Lector:

- `priority_vector = {plot: 0.5, characters: 0.3333, emotion: 0.1667, ideas: 0, atmosphere: 0, style: 0}`
- Dimensiones activas (no null, `confidence >= 0.15`): `hook_need (0.80, conf 0.62)`, `narrative_pace (0.70, conf 0.48)`, `tension_preference (0.85, conf 0.50)`, `comfort_preference (0.40, conf 0.30)`.
- Tags: `{psychological_thriller (aff 0.80, conf 0.75)}`, `{slow_burn_unsupported (aff -0.50, conf 0.40)}`.
- `soft_aversion = ["repetitive_internal_monologue"]` con confianza `0.55`.
- `discovery_appetite = 0.30`.

Libro candidato:

- Features activas: `hook_speed=0.70 (conf 0.78)`, `narrative_pace=0.60 (conf 0.70)`, `tension_level=0.90 (conf 0.80)`, `comfort_level=0.30 (conf 0.65)`, `emotional_intensity=0.85 (conf 0.72)`, `introspection_density=0.85 (conf 0.60)`.
- Auxiliares: `attention_demand=0.40 (conf 0.70)`, `linguistic_complexity=0.50 (conf 0.65)`, `structural_complexity=0.45 (conf 0.70)`, `conceptual_density=0.55 (conf 0.60)`, `worldbuilding_load=0.30 (conf 0.65)`, `popularity_score=0.20 (conf 0.85)`, `author_novelty_indicator=0.60 (conf 0.70)`.
- Tags: `psychological_thriller` (strength `0.90`).
- `feature_coverage_ratio = 0.94`; todas `scoring_required_minimum` presentes con `confidence >= 0.20` and `review_status = approved`; `scoring_minimum_confidence_factor ≈ 0.74`.
- `format = "physical"`, `pages = 320`.

Request:

- `requested_discovery_level = 0.40`, `reading_time_minutes_per_week = 210`, `primary_goal = "feel_tension"`, `secondary_goals = []`, `desired_emotions = ["tension"]`, `preferred_max_pages = 380`, `available_energy = 0.80`.

Restricciones: `preferred_pages = {180, 420}` (perfil) y request cap `380` ⇒ rango efectivo `{180, 380}`. Libro `pages = 320`.

### 11.2 `domain_weight`

`raw_domain_weight`:
- d1 `plot 0.6 × 0.5 = 0.30`
- d2 `plot 0.4 × 0.5 = 0.20`
- d3 `characters 1.0 × 0.3333 = 0.3333`
- d5 `emotion 1.0 × 0.1667 = 0.1667`
- d4 = 0; d6 = 0 (ideas = 0).

`effective_raw[d] = raw + 0.10` ⇒ d1=0.40, d2=0.30, d3=0.4333, d4=0.10, d5=0.2667, d6=0.10. Σ = 1.6000.

Normalizado: d1=0.2500, d2=0.1875, d3=0.2708, d4=0.0625, d5=0.1667, d6=0.0625. Σ = 1.0000 ✓ (no hay `tag_domain_weight` en 1.1).

### 11.3 `eligible_dims` y `dimension_weight`

Activas: `hook_need ↔ hook_speed` (d1), `narrative_pace ↔ narrative_pace` (d1), `tension_preference ↔ tension_level` (d5), `comfort_preference ↔ comfort_level` (d5).

- `active_dim_count_in_domain(d1) = 2`
- `active_dim_count_in_domain(d5) = 2`
- d2, d3, d4, d6 no tienen activas ⇒ se redistribuyen.

`dimension_weight` inicial (antes de redistribución):

- d1 (2 dims): `0.2500 / 2 = 0.1250` cada una.
- d5 (2 dims): `0.1667 / 2 = 0.0833` cada una.

Σ inicial activas = `0.1250 × 2 + 0.0833 × 2 = 0.4166`. Inactivas = `1.0000 − 0.4166 = 0.5834` a redistribuir sobre las activas.

Factor de normalización: `1.0000 / 0.4166 = 2.4004`.

```text
hook_need            = 0.1250 × 2.4004 = 0.3000  (≈0.3001)
narrative_pace       = 0.1250 × 2.4004 = 0.3000
tension_preference   = 0.0833 × 2.4004 = 0.2000
comfort_preference   = 0.0833 × 2.4004 = 0.2000
```

Σ dimension_weight ≈ `1.0000` ✓

### 11.4 `numeric_fit_score` (con `effective_weight`)

`compatible` (todos `target`, clamp `0..1`):

- `hook_speed`: `1 − |0.80 − 0.70| = 0.90`
- `narrative_pace`: `1 − |0.70 − 0.60| = 0.90`
- `tension_level`: `1 − |0.85 − 0.90| = 0.95`
- `comfort_level`: `1 − |0.40 − 0.30| = 0.90`

`effective_weight = dimension_weight × reader_confidence × book_confidence`:

| dim | dim_weight | r_conf | b_conf | effective_weight | compat | EW × compat |
|---|---:|---:|---:|---:|---:|---:|
| hook_need | 0.3000 | 0.62 | 0.78 | 0.1451 | 0.90 | 0.1306 |
| narrative_pace | 0.3000 | 0.48 | 0.70 | 0.1008 | 0.90 | 0.0907 |
| tension_preference | 0.2000 | 0.50 | 0.80 | 0.0800 | 0.95 | 0.0760 |
| comfort_preference | 0.2000 | 0.30 | 0.65 | 0.0390 | 0.90 | 0.0351 |
| **Σ** |  |  |  | **0.3649** |  | **0.3324** |

```text
numeric_fit_score = Σ_EWC / Σ_EW = 0.3324 / 0.3649 = 0.9109
```

Notar: la confianza **sólo** reordena los pesos, no escala la compatibilidad. Por eso el score es sustancialmente mayor que en v1.0 (ver §11.10 diff).

`coverage_ratio = 4 / 4 = 1.0` (diagnóstica; no multiplica). No existe `numeric_fit_score_final` distinto.

### 11.5 `tag_fit_score`

Match: `psychological_thriller` (`user_affinity = 0.80`, `book_tag_strength = 0.90`, `user_confidence = 0.75`).

- `raw = 0.80 × 0.90 × 0.75 = 0.5400`
- `scale = |0.80| + |-0.50| = 1.3000`
- `tag_fit_score_signed = 0.5400 / 1.3000 = 0.4154`
- `tag_fit_score = (0.4154 + 1) / 2 = 0.7077`

### 11.6 `context_fit_score`

- `length_fit`: `pages = 320 ∈ [180, 380]` ⇒ `1.0`.
- `reading_time_fit`: `pages_per_week = 210 × 200 / 250 = 168`; `weeks_needed = 320/168 = 1.9048`; `≤ 6` ⇒ `1.0`.
- `goal_fit`: `feel_tension` ⇒ `tension_level` (t 1.0 ⇒ `0.90`), `emotional_intensity` (t 1.0, `0.85` ⇒ `0.85`). Ambas presentes. `goal_fit = (0.90 + 0.85)/2 = 0.875`.
- `emotion_fit`: `["tension"]` ⇒ `tension_level` (`0.90`), `emotional_intensity` (`0.85`). `emotion_fit = (0.90 + 0.85)/2 = 0.875`.
- `effort_fit` (nuevo en 1.1): `available_energy = 0.80` ⇒ `effort_upper = 0.40 + 0.60 × 0.80 = 0.88`.
  - `max(attention_demand=0.40, linguistic_complexity=0.50, structural_complexity=0.45) = 0.50`
  - `max(conceptual_density=0.55, worldbuilding_load=0.30) = 0.55`
  - `book_effort_load = 0.5 × 0.50 + 0.5 × 0.55 = 0.525 ≤ 0.88` ⇒ `effort_fit = 1.0`.

Pesos (1.1): `length 0.25, reading_time 0.20, goal 0.25, emotion 0.15, effort 0.15`.

```text
context_fit_score = 0.25 × 1.0 + 0.20 × 1.0 + 0.25 × 0.875 + 0.15 × 0.875 + 0.15 × 1.0
                  = 0.2500 + 0.2000 + 0.2188 + 0.1313 + 0.1500
                  = 0.9501  → redondear a 0.9500
```

### 11.7 `discovery_fit_score`

`requested_discovery_level = 0.40` (no es null) ⇒ `effective_appetite = 0.40`.

`book_discovery_profile = 0.5 × (1 − 0.20) + 0.5 × 0.60 = 0.5 × 0.80 + 0.5 × 0.60 = 0.70`.

```text
discovery_fit_score = 1 − |0.70 − 0.40| = 1 − 0.30 = 0.7000
```

### 11.8 `risk_penalty`

- `coverage_penalty` (1.1): `scoring_minimum_confidence_factor = 0.74 ≥ 0.50` ⇒ `coverage_penalty = 0`. (Auch: para este candidato plenamente clasificado, el término es cero por diseño.)
- `soft_aversion_penalty`: `repetitive_internal_monologue` ↔ condición `introspection_density >= 0.70` (catálogo de `soft_aversion_definitions`); `book.introspection_density = 0.85 ≥ 0.70` ⇒ `match_factor = 1`. `× 0.08 × 0.55 = 0.0440`.
- `conditional_rule_penalty`: sin reglas activas ⇒ `0`.

`risk_penalty = clamp(0 + 0.0440 + 0, 0, 0.40) = 0.0440`.

### 11.9 `final_score`

Ningún componente `null` ⇒ pesos originales:

```text
final_score = 0.50 × 0.9109 + 0.20 × 0.7077 + 0.20 × 0.9500 + 0.10 × 0.7000 − 0.0440
            = 0.4555 + 0.1415 + 0.1900 + 0.0700 − 0.0440
            = 0.8130
```

`clamp(0.8130, 0, 1) = 0.8130`. Persistir a 4 decimales.

### 11.10 `recommendation_evidence_coverage`

8 componentes en 1.1 (añadido `effort`):

- numeric ✓, tag ✓, length ✓, reading_time ✓, goal ✓, emotion ✓, effort ✓ (features de effort presentes), discovery ✓ ⇒ `8/8 = 1.0000`.

### 11.11 Tabla diff v1.0 → v1.1

| Componente | v1.0.0 | v1.1.0 | Comentario |
|---|---:|---:|---|
| `numeric_fit_score` | 0.3330 | 0.9109 | Confianza ahora es peso, no multiplicador |
| `numeric_fit_score_final` | 0.3330 | 0.9109 | Eliminado `coverage_adjustment` |
| `tag_fit_score` | 0.7077 | 0.7077 | Sin cambios |
| `context_fit_score` | 0.9438 | 0.9500 | Añadido `effort_fit = 1.0`, reajuste de pesos |
| `discovery_fit_score` | 0.5500 | 0.7000 | `book_discovery_profile` 0.80→0.70 con `author_novelty_indicator` |
| `risk_penalty` (coverage) | 0.0000 | 0.0000 | Cobertura plena en ambos |
| `risk_penalty` (soft_aversion) | 0.0440 | 0.0440 | Sin cambios |
| `risk_penalty` (low_evidence) | 0.0000 | — | Término eliminado |
| `final_score` | **0.5078** | **0.8130** | Recalculo completo |

Saltar numeric de 0.33 a 0.91 refleja la nueva semántica: la incertidumbre **ya no rebaja** el compatibility de un match; sólo reduce el peso relativo de la dimensión dentro del promedio. La calidad/cobertura de evidencia quedó en métricas diagnósticas separadas.

---

## 12. Pruebas de determinismo

1. **Mismas entradas → mismo `final_score`** a ±0.0001, sin importar el orden de carga de evidencias.
2. **Cambio del orden de las dimensiones en memoria** no afecta `Σ_EW` ni `Σ_EWC`.
3. **Recomputación idempotente** (ver `reader_profile_spec.md` §18 y §26.3): un segundo cálculo sobre el mismo `evidence_set_hash` y la misma `calculation_version` devuelve el snapshot existente; **no crea nueva `profile_version`**.
4. **`numeric_fit_score = null` (`Σ_EW = 0`) ⇒ bloqueo**: el candidato queda `review_status = blocked` con `block_reason = numeric_no_eligible_dims`.
5. **Redistribución de pesos**: cuando `tag_fit_score = null`, los pesos en `final_score` suman exacto a `1.0000` tras normalización.
6. **Redistribución interna de `context_fit_score`**: cuando un sub-score es `null`, los sub-pesos restantes suman `1.0000` dentro de `context_fit_score`.
7. **`risk_penalty` no negativo y ≤ 0.40**.
8. **`final_score ∈ [0, 1]`** en cualquier combinación de inputs.
9. **`recommendation_evidence_coverage`** se calcula sobre los componentes efectivamente alimentados y coincide con la suma de flags persistidos en `evaluation_meta_json`.
10. **Snapshot de perfil estable**: dos invocaciones de `recompute` sin nuevas evidencias devuelven el mismo `profile_version` y `snapshot_json` (no crean nueva versión).
11. **`coverage_penalty = 0` para candidatos plenamente clasificados**: ordenar `scoring_minimum_confidence_factor >= 0.50` ⇒ `coverage_penalty = 0`.
12. **No hay imputación de `0.5`**: para un `book_value = null` en `goal_fit`, el sub-score se recalcula excluyendo la feature; persistir `0.5` neutral es una violación en 1.1.
13. **`requested_discovery_level = null`**: `effective_appetite = reader.discovery_appetite` exacto; `discovery_fit_score` no se fuerza a `null`.
14. **`coverage_ratio < 0.40`** (lector) ya **no bloquea**; sólo aparece en métricas diagnósticas.

---

## 13. Relación con otros documentos

- `reader_profile_spec.md` §9, §10, §14 son la base; aquí se refinan las fórmulas y se eliminan las variables indefinidas.
- `book_taxonomy_spec.md` produce `value`, `confidence`, `feature_coverage_ratio`, `discovery_profile`, `popularity_score`, `author_novelty_indicator`.
- `tag_taxonomy_v1.md` define el catálogo de tags consumido por §5.3.

---

## 14. No objetivos (MVP)

- Pesos entrenados por ML (`learning-to-rank`).
- Optimización `discovery_fit_score` por reinforcement.
- Re-ponderación automática de `priority_vector` según feedback.
- Personalización por usuario de los pesos `numeric/tag/context/discovery` (la redistribución de pesos por `null` es genérica, no por usuario).
