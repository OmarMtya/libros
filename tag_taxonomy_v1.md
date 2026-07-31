# Taxonomía de etiquetas v1

**Documento:** `tag_taxonomy_v1.md`
**Versión:** `1.0.1`
**Sustentante:** complemento normativo de `reader_profile_spec.md` v1.1.1 y de `book_taxonomy_spec.md` v1.1
**Audiencia:** backend, curaduría editorial, agentes de IA, producto
**Idioma de etiquetas visibles:** español de México

## Changelog 1.0.1

- **Split de `cultural_context`**: `anglo_american` queda **deprecated** con `replacement_tag_key = anglo_united_states`. Nuevos `anglo_united_kingdom`, `southeast_asia`. `hispanic_mexico` y `latin_american` separados explícitamente.
- **Amplía no ficción** a `history`, `biography_memoir`, `journalism`, `science`, `politics_society`, `philosophy`, `economics`. Se añaden como `genre` al catálogo.
- **Asertar escalas**: `book_tag_strength ∈ [0, 1]`, `user_affinity ∈ [-1, 1]` explícito.
- **Herencia** `parent_tag_key` documentada: en v1 **no** se hereda automáticamente; se persiste padre + hijo explícito.
- Corrige typos residuales («detektive» → «detective», «explication miraculous» → «explicación milagrosa», «migasión» → «migración»).

---

## 1. Objetivo

Proporcionar un **catálogo cerrado y versionado** de etiquetas (`tag`) por `tag_type`, con claves estables, descripciones, aliases y reglas de gobernanza. El sistema **no permite** crear `tag_key` en tiempo de ejecución; toda etiqueta mostrada al usuario o persistida en evidencia debe existir en este catálogo o en una versión posterior publicada formalmente.

---

## 2. Convenciones

1. `tag_key` es `snake_case`, en inglés cuando aplique, estable y **inmutable** una vez publicada su versión.
2. El `name` (visible) está en español; los alias listan sinónimos en español e inglés.
3. Cada tag tiene un único `tag_type`.
4. Una etiqueta puede tener `parent_tag_key` para agruparse (p.ej. subgéneros bajo géneros), pero la herencia **no** es semántica salvo decisión explícita de la regla de scoring (§13).
5. `status`: `active` | `deprecated`. Una etiqueta `deprecated` incluye `replacement_tag_key`.
6. La migración `tag_taxonomy_v1` → `vN` se documenta con reglas en §14; las evidencias históricas conservan el `tag_key` original siempre.
7. Cada evidencia de tag persiste con `tag_taxonomy_version` usado.

---

## 3. `tag_type` permitidos

Enumeración cerrada (espejo de `reader_profile_spec.md` §7):

- `genre`
- `subgenre`
- `theme`
- `setting`
- `period`
- `cultural_context`
- `narrative_motif`

Otras categorías requieren bump mayor de taxonomía.

---

## 4. Catálogo v1

### 4.1 `genre` (22)

| `tag_key` | `name` | `aliases` |
|---|---|---|
| `literary_fiction` | Novela literaria | ficción literaria, literary fiction |
| `mystery` | Misterio | misterio policial, mystery |
| `thriller` | Suspenso | suspense, thriller |
| `horror` | Terror | horror |
| `romance` | Romance | romance, love story |
| `science_fiction` | Ciencia ficción | ciencia ficción, sci-fi, CF |
| `fantasy` | Fantasía | fantasía, fantasy |
| `historical_fiction` | Ficción histórica | ficción histórica, historical fiction |
| `adventure` | Aventura | aventura, adventure |
| `comedy` | Comedia | comedia, humor, comedy |
| `speculative_fiction` | Especulativa | especulativa, speculative fiction, weird fiction |
| `realistic_fiction` | Realista | ficción realista, realistic fiction, drama cotidiano |
| `narrative_nonfiction` | No ficción narrativa | no ficción narrativa, narrative nonfiction, crónica |
| `essay_memoir` | Ensayo y memorialística | ensayo, memorias, memoir, essay |
| `short_story_collection` | Cuentos | cuentos, short stories, relatos |
| `history` | Historia (no ficción) | historia, history, ensayo histórico |
| `biography_memoir` | Biografía y memorias | biografía, memorias, biography, memoir |
| `journalism` | Periodismo / crónica | periodismo, crónica, journalism, reportaje |
| `science` | Ciencia (no ficción) | ciencia, divulgación científica, science, popular science |
| `politics_society` | Política y sociedad | política, sociedad, essays politics, sociedad y política |
| `philosophy` | Filosofía | filosofía, philosophy, ensayo filosófico |
| `economics` | Economía | economía, economics, ensayo económico |

> Los subgéneros de ficción (`subgenre`, ver §4.2) siguen sin estar replicados para los no ficción; un libro `history` no entra automáticamente a `historical_fiction`. El match es por `tag_key` exacto.

### 4.2 `subgenre` (24)

| `tag_key` | `parent_tag_key` | `name` | `aliases` |
|---|---|---|---|
| `cozy_mystery` | `mystery` | Misterio acogedor | cozy mystery |
| `procedural` | `mystery` | Procedural | procedural policial |
| `noir` | `mystery` | Noir | noir, novela negra |
| `hardboiled` | `mystery` | Hardboiled | hardboiled, detective duro |
| `psychological_thriller` | `thriller` | Thriller psicológico | suspense psicológico, psychological thriller |
| `spy_thriller` | `thriller` | Espionaje | spy thriller, espías |
| `techno_thriller` | `thriller` | Tecno-thriller | techno thriller |
| `legal_thriller` | `thriller` | Judicial | thriller judicial, legal thriller |
| `cosmic_horror` | `horror` | Horror cósmico | horror cósmico, cosmic horror |
| `psychological_horror` | `horror` | Horror psicológico | psychological horror |
| `slasher` | `horror` | Slasher | slasher |
| `gothic_horror` | `horror` | Gótico | horror gótico, gothic horror |
| `space_opera` | `science_fiction` | Space opera | space opera |
| `hard_scifi` | `science_fiction` | Ciencia ficción dura | hard sci-fi, hard SF |
| `cyberpunk` | `science_fiction` | Cyberpunk | cyberpunk |
| `dystopia` | `science_fiction` | Distopía | dystopia, distopía |
| `high_fantasy` | `fantasy` | Fantasía épica | alta fantasía, high fantasy |
| `urban_fantasy` | `fantasy` | Fantasía urbana | fantasía urbana, urban fantasy |
| `dark_fantasy` | `fantasy` | Fantasía oscura | dark fantasy |
| `magical_realism` | `speculative_fiction` | Realismo mágico | realismo mágico, magical realism |
| `alternate_history` | `speculative_fiction` | Historia alternativa | alternate history |
| `slipstream` | `speculative_fiction` | Slipstream | slipstream |
| `paranormal_romance` | `romance` | Romance paranormal | paranormal romance |
| `satire` | `comedy` | Sátira | sátira, satire |

### 4.3 `theme` (24)

| `tag_key` | `name` | `aliases` |
|---|---|---|
| `love` | Amor | amor, love |
| `identity` | Identidad | identidad, identity |
| `grief` | Duelo | duelo, grief, pérdida |
| `family` | Familia | familia, family |
| `friendship` | Amistad | amistad, friendship |
| `betrayal` | Traición | traición, betrayal |
| `redemption` | Redención | redención, redemption |
| `justice` | Justicia | justicia, justice |
| `power` | Poder | poder, power |
| `freedom` | Libertad | libertad, freedom |
| `war` | Guerra | guerra, war |
| `migration` | Migración | migración, migration, exilio |
| `memory` | Memoria | memoria, memory |
| `loneliness` | Soledad | soledad, loneliness |
| `ambition` | Ambición | ambición, ambition |
| `faith_doubt` | Fe y duda | fe y duda, faith and doubt |
| `technology_society` | Tecnología y sociedad | technology and society |
| `environment` | Naturaleza y entorno | environment, ecología |
| `mental_health` | Salud mental | salud mental, mental health |
| `addiction` | Adicción | adicción, addiction |
| `coming_of_age` | Madurez | coming of age, madurez |
| `forgiveness` | Perdón | perdón, forgiveness |
| `mortality` | Mortalidad | mortalidad, muerte, death |
| `moral_dilemma` | Dilema moral | dilema moral, moral dilemma |

### 4.4 `setting` (12)

| `tag_key` | `name` | `aliases` |
|---|---|---|
| `urban` | Urbano | urbano, urban, ciudad |
| `rural` | Rural | rural, campo |
| `small_town` | Pueblo pequeño | small town |
| `arctic` | Ártico / polar | arctic, polar |
| `desert` | Desierto | desert |
| `island` | Isla | island, insular |
| `maritime` | Marítimo | maritime, mar |
| `mountain` | Montaña | mountain |
| `war_zone` | Zona de conflicto | war zone |
| `dystopian_city` | Ciudad distópica | dystopian city |
| `village` | Aldea | village, pueblo |
| `metropolis` | Metrópolis | metropolis, gran ciudad |

### 4.5 `period` (8)

| `tag_key` | `name` | `aliases` |
|---|---|---|
| `pre_1900` | Anterior a 1900 | pre 1900, antiguo |
| `early_20th_century` | Primer tercio s. XX | early 20th century |
| `mid_20th_century` | Mediados s. XX | mid 20th century |
| `late_20th_century` | Finales s. XX | late 20th century |
| `contemporary` | Contemporáneo | contemporáneo, contemporary |
| `near_future` | Futuro cercano | near future |
| `distant_future` | Futuro lejano | distant future |
| `mythic_past` | Pasado mítico | mythic past, ancestral |

### 4.6 `cultural_context` (12)

| `tag_key` | `name` | `aliases` | status |
|---|---|---|---|
| `latin_american` | Latinoamericano (excluyendo México) | latin american, latinoamericano | active |
| `hispanic_mexico` | México | mexicano, México | active |
| `anglo_united_states` | Anglonorteamericano (EE.UU.) | united states, EE.UU., american, estadounidense | active |
| `anglo_united_kingdom` | Reino Unido / británico | united kingdom, UK, británico, british | active |
| `anglo_american` | **deprecated** — alias de `anglo_united_states` | — | deprecated (replacement: `anglo_united_states`) |
| `european` | Europeo | european, Europa | active |
| `east_asian` | Asiático oriental | east asian, China, Japón, Corea | active |
| `south_asian` | Asia del Sur | south asian, India, Pakistán, Bangladesh | active |
| `southeast_asian` | Sudeste asiático | southeast asian, Vietnam, Tailandia, Indonesia, Filipinas | active |
| `middle_eastern` | Medio Oriente | middle eastern | active |
| `african` | Africano | african | active |
| `indigenous` | Indígena | indigenous, originario | active |
| `diaspora` | Diáspora | diaspora, diáspora | active |

Reglas:

- Las evidencias históricas con `tag_key = anglo_american` se conservan; el scoring las sustituye por `anglo_united_states` antes del match (ver §8). En una migración controlada se reetiquetarán curatorialmente los libros con autor claramente británico a `anglo_united_kingdom`; el resto de EE.UU. a `anglo_united_states`.
- `hispanic_mexico` separa explícitamente literatura mexicana de la latinoamericana general (`latin_american`). Un libro con `cultural_context = hispanic_mexico` NO entra automáticamente a `latin_american`.

### 4.7 `narrative_motif` (14)

| `tag_key` | `name` | `aliases` |
|---|---|---|
| `quest` | Búsqueda | quest, misión |
| `forbidden_love` | Amor prohibido | forbidden love |
| `chosen_one` | Elegido | chosen one |
| `unreliable_narrator` | Narrador no confiable | unreliable narrator |
| `locked_room_mystery` | Misterio de cuarto cerrado | locked room mystery |
| `time_loop` | Bucle temporal | time loop |
| `parallel_worlds` | Mundos paralelos | parallel worlds |
| `found_family` | Familia elegida | found family |
| `redemption_arc` | Arco de redención | redemption arc |
| `fall_of_hero` | Caída del héroe | fall of hero |
| `doppelganger` | Dobles / doppelgänger | doppelganger, doble |
| `secret_history` | Historia secreta | secret history |
| `last_survivor` | Último superviviente | last survivor |
| `epistolary` | Epistolar | epistolary |

---

## 5. Contrato JSON de una etiqueta

```json
{
  "tag_key": "psychological_thriller",
  "taxonomic_version": "tag-tax/1.0",
  "tag_type": "subgenre",
  "name": "Thriller psicológico",
  "description": "Suspense sostenido por la psique de los personajes; la tensión proviene más de lo que se oculta que de la acción física.",
  "aliases": ["suspense psicológico", "psychological thriller"],
  "parent_tag_key": "thriller",
  "status": "active",
  "replacement_tag_key": null,
  "created_at": "2026-07-30T00:00:00Z",
  "deprecated_at": null
}
```

---

## 6. `description` mínima (resumen de uso)

Cada etiqueta debe llevar una descripción de **≤ 280 caracteres** (mensurable, no publicitaria) que el panel de curaduría muestra como tooltip y que la IA puede usar como contexto del prompt (sin sustituir la definición canónica). Las descripciones completas viven en `tag_versions` (tabla §11.2).

Algunas descripciones guía:

- `psychological_thriller`: “Suspense sostenido por la psique de los personajes; la tensión proviene más de lo que se oculta que de la acción física.”
- `noir`: “Crímenes y ambientes urbanos corruptos, antihéroe cínico, tono nihilista.”
- `cosmic_horror`: “El horror proviene de fuerzas incomprensibles y cosmologías ajenas a lo humano.”
- `cozy_mystery`: “Misterio ligero sin violencia explícita, con detective amateur y ambiente cerrado y amable.”
- `magical_realism`: “Incorpora elementos mágicos en un marco realista, sin explicación milagrosa de lo sobrenatural.”
- `realistic_fiction`: “Ficción ambientada en el mundo real actual, con foco en conflictos cotidianos.”
- `narrative_nonfiction`: “Relato de hechos reales con técnica narrativa de novela.”

Las restantes se describen en `tag_versions.description` (ver §11.2) con redacción cuidada por curaduría.

---

## 7. Gobernanza del catálogo

### 7.1 Principios

1. **Estabilidad**: `tag_key` inmutable una vez publicada su major.
2. **Vaciabilidad**: una etiqueta nunca se elimina. Se `deprecated` con `replacement_tag_key`.
3. **Versionado semántico**: una nueva etiqueta agregada bumps minor (`tag-tax/1.1`); un cambio de criterio de aplicación o splitting/merge bumps major (`tag-tax/2.0`).
4. **Trazabilidad**: cada cambio se audita en `tag_taxonomy_audit`.

### 7.2 Agregar etiqueta

1. Propuesta en `tag_taxonomy_audit` por curador con `change_kind = add`, `payload` con la nueva definición y justificación.
2. Revisión por curador lead.
3. Al aprobarse: bump minor de `tag-tax`, se inserta la etiqueta con `status = active`.
4. Las etiquetas existentes se conservan intactas.
5. No se permite usar la nueva etiqueta en evidencias con `tag_taxonomy_version` anterior.

### 7.3 Fusionar etiqueta (merge)

1. Se `deprecate` la etiqueta de origen con `replacement_tag_key = destino`.
2. Se ejecuta una migración controlada que:
   - crea filas de `reader_tag_preferences` equivalentes sobre `destino` (sin borrar las originales),
   - crea `book_tags` equivalentes (sin borrar las originales),
   - actualiza `reader_evidence.raw_payload` agregando referencia al `replacement_tag_key` (sin modificar `tag_key` original en `tag_preferences`).
3. El scoring usa `replacement_tag_key` cuando encuentra una `tag_key deprecated` (§13).
4. Se audita cada movimiento.

### 7.4 Retirar etiqueta (deprecate sin merge)

1. Se `deprecate` con `replacement_tag_key = null`.
2. El scoring ignora la etiqueta en futuros matcheos, pero **las evidencias históricas se conservan**.
3. `raw_payload` queda intacto.
4. Si la etiqueta era `genre` o `subgenre`, su `parent_tag_key` queda para fines de reporting si aplica (no se hereda por scoring).

### 7.5 Dividir etiqueta (split)

Tratada como merge múltiple: la etiqueta original se `deprecated` con `replacement_tag_keys[]` (campo en `tag_versions`), y el curador reasigna evidencias caso por caso. No ocurre en v1; documentado para v2.

---

## 8. Reglas de matching en scoring

1. La coincidencia (match) entre preferencias del lector y tags del libro se calcula **sólo para tags con el mismo `tag_type`**.
2. Las etiquetas `deprecated` se sustituyen por `replacement_tag_key` antes del match (si `replacement_tag_key` existe), conservando la afinidad original.
3. Las etiquetas `deprecated` sin `replacement_tag_key` se ignoran en scoring (no penalizan, no premian).
4. **Escalas** (norma explícita en 1.0.1):
   - `book_tag_strength ∈ [0, 1]`: 0 = el libro no exhibe ese tag; >0 = el tag aplica con esa intensidad (no negativa).
   - `user_affinity ∈ [-1, 1]`: negativa = evita; 0 = neutral/desconocido; positiva = prefiere.
   - Match: `user_affinity × book_tag_strength × user_confidence`, sobre la intersección por `tag_type`.
5. La herencia por `parent_tag_key` **no** se aplica automáticamente en v1: si un usuario prefiere `thriller` y el libro sólo tiene `psychological_thriller`, no se transfiere la afinidad sin un match explícito. La persistencia padre + hijo es estructural (reportes, navegación), pero no influye en el score.

---

## 9. Privacidad

- Las etiquetas con contenido sensible (p.ej. `addiction`, `mental_health`) no son “exclusiones privadas”; son etiquetas de tema y siguen las reglas de visibilidad generales del producto.
- Las exclusiones privadas del usuario (`reader_profile_spec.md` §6, “preferencias privadas”) no se expresan como tags de este catálogo; son referencias por `tag_key` o **frases privadas**, pero el `tag_taxonomy_v1` no enumera contenido sensible explícito.

---

## 10. Restricciones del catálogo v1

## 10. Restricciones del catálogo v1.0.1

- 129 etiquetas activas: 22 genres + 24 subgenres + 24 themes + 12 settings + 8 periods + 13 cultural_context (12 active + 1 deprecated `anglo_american`) + 14 narrative_motifs. Ajusta el conteo anterior (107) tras añadir no ficción y splits.
- `tag_key` únicos globalmente (no se permiten dos tags con misma clave aunque difieran `tag_type`).
- Cada etiqueta con `parent_tag_key` exige que el padre exista y esté `active` o `deprecated` con `replacement`.
- **Herencia en v1**: persistencia explícita padre + hijo. No hay match automático por `parent_tag_key`: si un libro tiene `psychological_thriller` (subgenre, parent `thriller`) y el lector prefiere `thriller`, no se transfiere afinidad sin un match explícito (ver §8).
- `aliases` son únicos por etiqueta pero no globalmente; el autocompletado los prioriza pero resuelve colisiones por `tag_key`.

---

## 11. Tablas de taxonomía — identidad + versiones

Para conservar versiones históricas por `taxonomic_version`, el catálogo se divide en dos tablas:

### 11.1 `tag_identity` (clave estable, sin versiones)

| Columna | Tipo | Notas |
|---|---|---|
| `tag_key` | varchar(60) PK | |
| `canonical_taxonomic_version` | varchar(20) NOT NULL | versión vigente preferida |
| `current_status` | enum NOT NULL | `active`, `deprecated` |
| `current_replacement_tag_key` | varchar(60) nullable | FK a `tag_identity` |
| `created_at` | timestamptz NOT NULL | |

### 11.2 `tag_versions` (versiones históricas)

| Columna | Tipo | Notas |
|---|---|---|
| `tag_key` | varchar(60) NOT NULL FK a `tag_identity` | |
| `taxonomic_version` | varchar(20) NOT NULL | p.ej. `tag-tax/1.0.1` |
| `tag_type` | enum NOT NULL | §3 |
| `name` | varchar(120) NOT NULL | |
| `description` | varchar(280) NOT NULL | ≤ 280 |
| `aliases_json` | JSONB NOT NULL | array de strings |
| `parent_tag_key` | varchar(60) nullable | FK a `tag_identity` |
| `status` | enum NOT NULL | `active`, `deprecated` |
| `replacement_tag_key` | varchar(60) nullable | FK a `tag_identity` |
| `replacement_tag_keys_json` | JSONB nullable | para split (v2) |
| `created_at` | timestamptz NOT NULL | |
| `deprecated_at` | timestamptz nullable | |
| `deprecated_reason` | text nullable | |

PK compuesta: `(tag_key, taxonomic_version)`. Permite conservar todas las versiones históricas de cada etiqueta y reconstruir el catálogo tal como estaba en cualquier momento.

### 11.3 Reglas

- Las FK externas (`reader_tag_preferences.tag_key`, `book_tags.tag_key`) apuntan a `tag_identity.tag_key` (estable).
- Para resolver qué definición aplicar a una evidencia histórica con `taxonomic_version = X`, se consulta `tag_versions (tag_key, X)`.
- El catálogo vigente se reconstruye consultando la fila más reciente de `tag_versions` para cada `tag_key` con `status = active`.
- Editar `description` o renombrar `alias` crea nueva `taxonomic_version` (bump minor) y nuevo renglón en `tag_versions`; la fila vieja se conserva.

Restricciones:

```sql
CHECK (tag_key ~ '^[a-z][a-z0-9_]{2,59}$');
CHECK (status <> 'deprecated' OR replacement_tag_key IS NOT NULL OR deprecated_reason IS NOT NULL);
```

Índices: `tag_identity (current_status)`, `tag_versions (tag_type, status, taxonomic_version)`, `tag_versions (parent_tag_key)`.

---

## 12. `tag_taxonomy_audit`

| Columna | Tipo |
|---|---|
| `id` | UUID PK |
| `change_kind` | enum (`add`, `merge`, `deprecate`, `split`, `rename_alias`, `edit_description`) |
| `tag_key` | varchar |
| `payload_json` | JSONB |
| `reason` | text |
| `actor_id` | UUID |
| `actor_role` | enum (`curator_lead`, `admin`, `system`) |
| `created_at` | timestamptz |

---

## 13. Pruebas de aceptación

1. Una `tag_key` no listada en `tag_identity` se rechaza al insertar `reader_tag_preferences` o `book_tags` (FK explícito + check de `taxonomic_version` activa).
2. Insertar evidencias con `tag_taxonomy_version` posterior a la del sistema activo se rechaza.
3. Una etiqueta `deprecated` con `replacement_tag_key` produce el mismo `tag_fit_score` que su reemplazo (alta tolerancia ±0.0001) cuando la afinidad y la fortaleza son equivalentes.
4. Una etiqueta `deprecated` sin `replacement_tag_key` aporta `0` al `tag_fit_score`.
5. Auto-completar con un alias resuelve al `tag_key` único correcto; en colisión se requiere elegir explícito en UI.
6. `tag_key` no es reutilizable: una etiqueta retirada no puede volver a `active` con distinto significado (se crea nueva `tag_key`).
7. No se puede deprecar una etiqueta sin `deprecated_reason`.
8. Cambiar `description` bump minor de `taxonomic_version` y registra `rename_alias` o `edit_description` en auditoría.

---

## 14. Migración v1 → vN

- v1.0.1: split `cultural_context` (ver §4.6). La etiqueta `anglo_american` queda `deprecated` con `replacement_tag_key = anglo_united_states`. La migración controlada debe actualizar `book_tags` con autor o país de origen EE.UU. a `anglo_united_states` y con autor o país de origen Reino Unido a `anglo_united_kingdom`. Las `reader_tag_preferences` con `anglo_american` siguen funcionando vía sustitución por `replacement_tag_key` en el scoring.
- v1.1: permite agregar etiquetas activas (minor). No requiere migración de `reader_tag_preferences` o `book_tags`.
- v2.0: cambio mayor; se documentan reglas de migración cuando se introduzcan (`merge`, `split`, cambios de herencia). En cualquier caso, las evidencias históricas conservan la `tag_key` y `tag_taxonomy_version` original; el scoring consultará `replacement_tag_key` de la versión vigente.

---

## 15. Relación con otros documentos

- Refina y enumera el contenido de `reader_profile_spec.md` §7.
- Es consumido por `book_taxonomy_spec.md` §11.5 (tags en obra) y por `scoring_weights_spec.md` §5.3 (`tag_fit_score`).
- La regla de matching (§8) no contradice el principio del spec principal de no inventar claves en tiempo de ejecución.

---

## 16. No objetivos (v1)

- Etiquetas de contenido sensible explícitas.
- Tags generados automáticamente por IA (todas son propuestas curadas).
- Sugerencias automáticas al usuario que no existan en el catálogo.
- Co-autoría semántica entre etiquetas (p.ej. `psychological_thriller ⊕ noir`).
- Etiquetas con relevancia geográfica dinámica.