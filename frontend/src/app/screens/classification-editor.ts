import { Component, ElementRef, HostListener, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, ClassificationDiagnostics, ClassificationEditor, EditorFeature, EditorTag, Tag } from '../api.service';
import { ToastService } from '../toast.service';
import { TAG_LABELS, TAG_TYPE_LABELS } from '../labels';

const CONTENT_TYPES = [
  { key: 'fiction', label: 'Ficción' },
  { key: 'narrative_nonfiction', label: 'No ficción narrativa' },
  { key: 'expository_nonfiction', label: 'No ficción expositiva' },
  { key: 'memoir', label: 'Memorias' },
  { key: 'essay', label: 'Ensayo' },
  { key: 'short_stories', label: 'Cuentos' },
  { key: 'poetry', label: 'Poesía' },
  { key: 'other', label: 'Otro' },
];

const clamp = (raw: string | number, min: number, max: number): number => {
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
};

@Component({
  selector: 'app-classification-editor',
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <a routerLink="/app/admin" class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088] no-underline hover:text-coral">← Volver al catálogo</a>

      @if (editor(); as ed) {
        <div class="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="font-display text-4xl font-bold tracking-[-0.045em] text-ink">{{ ed.editionTitle }}</h1>
            <p class="mt-1 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">
              Clasificación manual · rev {{ ed.revision }} · {{ statusLabel(ed.status) }}
            </p>
          </div>
          <div class="flex gap-2">
            <button type="button" class="rounded-sm border border-[#7d9ab0] px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#e6eef3]" (click)="back()">Cerrar</button>
            @if (ed.status === 'draft') {
              <button type="button" class="rounded-sm border border-[#7d9ab0] px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#e6eef3]" (click)="discard()" [disabled]="busy()">Descartar borrador</button>
              <button type="button" class="rounded-sm bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink-soft disabled:cursor-wait disabled:opacity-60" (click)="save()" [disabled]="busy()">Guardar borrador</button>
              <button
                type="button"
                class="rounded-sm bg-coral px-4 py-2 text-sm font-bold text-white hover:bg-coral-deep disabled:cursor-not-allowed disabled:opacity-50"
                [disabled]="!canApprove()"
                [title]="approveHint()"
                (click)="approve()">Aprobar clasificación</button>
            } @else {
              <button type="button" class="rounded-sm bg-marker px-4 py-2 text-sm font-bold text-ink hover:brightness-95 disabled:cursor-wait disabled:opacity-60" (click)="createCorrection()" [disabled]="busy()">Crear corrección</button>
            }
          </div>
        </div>

        @if (ed.status !== 'draft') {
          <div class="mt-4 rounded-sm border-l-[3px] border-[#7d9ab0] bg-[#eef3f6] px-4 py-3 text-sm text-[#37505f]">
            Esta clasificación está <strong>{{ statusLabel(ed.status) }}</strong> y no puede modificarse directamente.
            Para corregirla, crea una nueva revisión en borrador con los valores precargados.
          </div>
        }

        <div class="mt-6 space-y-8">
          <section class="rounded-sm border border-[#cad7df] bg-white p-4">
            <h2 class="font-semibold text-ink">Tipo de contenido</h2>
            @if (ed.status === 'draft') {
              <select
                [ngModel]="ed.contentTypeKey"
                (ngModelChange)="onChangeContentType($event)"
                class="mt-2 rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                @for (contentType of CONTENT_TYPES; track contentType.key) {
                  <option [value]="contentType.key">{{ contentType.label }}</option>
                }
              </select>
              <p class="mt-1 text-xs text-[#536875]">Al cambiar el tipo se rederiva la aplicabilidad de cada feature.</p>
            } @else {
              <p class="mt-2 text-sm text-ink">{{ contentTypeLabel(ed.contentTypeKey) }}</p>
            }
          </section>

          @if (diagnostics(); as di) {
            <section class="rounded-sm border border-[#cad7df] bg-white p-4">
              <h2 class="font-semibold text-ink">Diagnóstico</h2>
              @if (di.featureCoverageRatio !== null && di.featureCoverageRatio < 0.7) {
                <div class="mt-3 flex items-start gap-2 rounded-sm border-l-[3px] border-amber-600 bg-[#fdf3d7] px-3 py-2 text-sm text-[#6b4d00]">
                  <span class="font-bold">Cobertura limitada.</span>
                  <span>La clasificación tiene poca cobertura de features y el scoring tendrá mayor incertidumbre.</span>
                </div>
              }
              <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div class="rounded-sm bg-[#f2f6f9] p-3">
                  <p class="font-mono text-[11px] uppercase tracking-wider text-[#567088]">Cobertura</p>
                  <p class="mt-1 text-2xl font-bold text-ink">{{ di.featureCoverageRatio === null ? '—' : (di.featureCoverageRatio * 100).toFixed(1) + '%' }}</p>
                </div>
                <div class="rounded-sm bg-[#f2f6f9] p-3" [class.bg-[#fbe9e6]]="di.missingRequired.length > 0">
                  <p class="font-mono text-[11px] uppercase tracking-wider text-[#567088]">Obligatorias faltantes</p>
                  <p class="mt-1 text-2xl font-bold" [class.text-[#7a2c1f]]="di.missingRequired.length > 0">{{ di.missingRequired.length }}</p>
                  @if (di.missingRequired.length > 0) {
                    <p class="mt-1 font-mono text-[11px] text-[#7a2c1f]">{{ di.missingRequired.join(', ') }}</p>
                  }
                </div>
                <div class="rounded-sm bg-[#f2f6f9] p-3">
                  <p class="font-mono text-[11px] uppercase tracking-wider text-[#567088]">Opcionales faltantes</p>
                  <p class="mt-1 text-2xl font-bold text-ink">{{ di.optionalMissing.length }}</p>
                  @if (di.optionalMissing.length > 0) {
                    <details>
                      <summary class="cursor-pointer font-mono text-[11px] text-[#567088]">ver lista</summary>
                      <p class="mt-1 font-mono text-[11px] text-[#37505f]">{{ di.optionalMissing.join(', ') }}</p>
                    </details>
                  }
                </div>
                <div class="rounded-sm bg-[#f2f6f9] p-3">
                  <p class="font-mono text-[11px] uppercase tracking-wider text-[#567088]">No aplicables</p>
                  <p class="mt-1 text-2xl font-bold text-ink">{{ di.notApplicable.length }}</p>
                </div>
                <div class="rounded-sm bg-[#f2f6f9] p-3" [class.bg-[#fbe9e6]]="di.configurationErrors.length > 0">
                  <p class="font-mono text-[11px] uppercase tracking-wider text-[#567088]">Errores de configuración</p>
                  <p class="mt-1 text-2xl font-bold" [class.text-[#7a2c1f]]="di.configurationErrors.length > 0">{{ di.configurationErrors.length }}</p>
                  @if (di.configurationErrors.length > 0) {
                    <p class="mt-1 font-mono text-[11px] text-[#7a2c1f]">{{ di.configurationErrors.join(', ') }}</p>
                  }
                </div>
                <div class="rounded-sm bg-[#f2f6f9] p-3">
                  <p class="font-mono text-[11px] uppercase tracking-wider text-[#567088]">Tags (género · subgénero · tema)</p>
                  <p class="mt-1 text-2xl font-bold text-ink">{{ di.tags.genre }} · {{ di.tags.subgenre }} · {{ di.tags.theme }}</p>
                </div>
              </div>
              <p class="mt-3 text-sm">
                Resultado:
                @if (di.passes) {
                  <span class="rounded-full bg-[#e2f0e9] px-2.5 py-0.5 font-bold text-[#16442f]">aprobable</span>
                } @else {
                  <span class="rounded-full bg-[#fbe9e6] px-2.5 py-0.5 font-bold text-[#7a2c1f]">no aprueba</span>
                }
              </p>
            </section>
          }

          @if (ed.status === 'draft') {
            <section #aiSection class="rounded-sm border border-[#cad7df] bg-white p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="font-semibold text-ink">Clasificar con IA</h2>
                  <p class="mt-1 text-xs text-[#536875]">Sube el PDF del libro (formato de texto). El análisis corre en segundo plano y los valores se guardan directamente en el borrador: puedes cerrar o recargar la página sin perderlos. Revisa antes de guardar y aprobar.</p>
                </div>
                <button type="button" class="rounded-sm bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink-soft disabled:cursor-wait disabled:opacity-60" (click)="pdfInput.click()" [disabled]="aiClassifying()">
                  {{ aiClassifying() ? 'Analizando…' : 'Subir PDF y clasificar' }}
                </button>
                <input #pdfInput type="file" accept="application/pdf" hidden (change)="onPdfSelected($event)" />
              </div>
              @if (aiClassifying()) {
                <p class="mt-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#7d9ab0]">
                  <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  El análisis continúa en segundo plano y se guardará como borrador al terminar…
                </p>
              }
            </section>

            <section class="rounded-sm border border-[#cad7df] bg-white p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="font-semibold text-ink">Carga rápida por JSON</h2>
                <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-xs font-bold text-[#37505f] transition hover:bg-[#e6eef3]" (click)="togglePaste()">{{ pasteOpen() ? 'Ocultar' : 'Pegar JSON' }}</button>
              </div>
              @if (pasteOpen()) {
                <p class="mt-2 text-xs text-[#536875]">Pega un objeto <code class="font-mono">&#123; "featureKey": &#123; "value": 0.5, "confidence": 0.5 &#125; &#125;</code>. Al aplicar solo sobreescribe los inputs del formulario (no se guarda en la base).</p>
                <textarea [(ngModel)]="pasteJson" rows="10" placeholder='hook_speed: &#123; "value": 0.82, "confidence": 0.78 &#125;, narrative_pace: …' class="mt-2 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2 font-mono text-xs"></textarea>
                <div class="mt-2 flex gap-2">
                  <button type="button" class="rounded-sm bg-ink px-4 py-1.5 text-sm font-bold text-white hover:bg-ink-soft disabled:cursor-wait disabled:opacity-60" (click)="applyPaste()" [disabled]="busy()">Aplicar al formulario</button>
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-4 py-1.5 text-sm font-bold text-[#37505f] transition hover:bg-[#e6eef3]" (click)="closePaste()">Cancelar</button>
                </div>
              }
            </section>

            <section>
              <h2 class="font-semibold text-ink">Features obligatorias</h2>
              <div class="mt-2 space-y-3">
                @for (feature of requiredFeatures(); track feature.featureKey) {
                  @if (featureCard(feature); as card) {
                    <div class="rounded-sm border border-[#d6e1e8] p-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <strong class="text-ink">{{ card.feature.label }}</strong>
                        <span class="rounded-full bg-[#fbe9e6] px-2 py-0.5 text-[11px] font-semibold text-[#7a2c1f]">obligatoria</span>
                        <span class="font-mono text-[11px] text-[#567088]">{{ card.feature.featureKey }}</span>
                      </div>
                      <p class="mt-1 text-xs text-[#536875]">{{ card.feature.description }}</p>
                      <p class="mt-1 font-mono text-[11px] text-[#7d9ab0]">0 → {{ card.feature.meaningZero }} · 1 → {{ card.feature.meaningOne }}</p>
                      <div class="mt-2 flex flex-wrap items-center gap-4">
                        <label class="flex min-w-[16rem] flex-1 items-center gap-3 text-xs text-[#536875]">
                          value
                          <input type="range" min="0" max="1" step="0.01" [value]="card.feature.value ?? 0" (input)="onRangeValue(card.feature, $event)" class="flex-1 accent-[#ff7a59]">
                          <input type="number" min="0" max="1" step="0.01" [ngModel]="card.feature.value ?? ''" (ngModelChange)="onValueInput(card.feature, $event)" class="w-20 rounded-sm border border-[#9eb2c1] px-2 py-1">
                        </label>
                        <label class="flex items-center gap-2 text-xs text-[#536875]">
                          confidence
                          <input type="number" min="0" max="0.95" step="0.05" [ngModel]="card.feature.confidence ?? ''" (ngModelChange)="onConfidenceInput(card.feature, $event)" class="w-20 rounded-sm border border-[#9eb2c1] px-2 py-1">
                        </label>
                      </div>
                      <label class="mt-2 flex items-start gap-2 text-xs text-[#536875]">
                        notas
                        <textarea [ngModel]="card.feature.notes ?? ''" (ngModelChange)="onNotesInput(card.feature, $event)" rows="1" class="min-w-[16rem] flex-1 rounded-sm border border-[#9eb2c1] px-2 py-1"></textarea>
                      </label>
                    </div>
                  }
                }
              </div>
            </section>

            <section>
              <h2 class="font-semibold text-ink">Features opcionales</h2>
              <div class="mt-2 space-y-3">
                @for (feature of optionalFeatures(); track feature.featureKey) {
                  @if (featureCard(feature); as card) {
                    <div class="rounded-sm border border-[#d6e1e8] p-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <strong class="text-ink">{{ card.feature.label }}</strong>
                        <span class="rounded-full bg-[#eef3f6] px-2 py-0.5 text-[11px] font-semibold text-[#567088]">opcional</span>
                        <span class="font-mono text-[11px] text-[#567088]">{{ card.feature.featureKey }}</span>
                      </div>
                      <p class="mt-1 text-xs text-[#536875]">{{ card.feature.description }}</p>
                      <p class="mt-1 font-mono text-[11px] text-[#7d9ab0]">0 → {{ card.feature.meaningZero }} · 1 → {{ card.feature.meaningOne }}</p>
                      <div class="mt-2 flex flex-wrap items-center gap-4">
                        <label class="flex min-w-[16rem] flex-1 items-center gap-3 text-xs text-[#536875]">
                          value
                          <input type="range" min="0" max="1" step="0.01" [value]="card.feature.value ?? 0" (input)="onRangeValue(card.feature, $event)" class="flex-1 accent-[#ff7a59]">
                          <input type="number" min="0" max="1" step="0.01" [ngModel]="card.feature.value ?? ''" (ngModelChange)="onValueInput(card.feature, $event)" class="w-20 rounded-sm border border-[#9eb2c1] px-2 py-1">
                        </label>
                        <label class="flex items-center gap-2 text-xs text-[#536875]">
                          confidence
                          <input type="number" min="0" max="0.95" step="0.05" [ngModel]="card.feature.confidence ?? ''" (ngModelChange)="onConfidenceInput(card.feature, $event)" class="w-20 rounded-sm border border-[#9eb2c1] px-2 py-1">
                        </label>
                      </div>
                      <label class="mt-2 flex items-start gap-2 text-xs text-[#536875]">
                        notas
                        <textarea [ngModel]="card.feature.notes ?? ''" (ngModelChange)="onNotesInput(card.feature, $event)" rows="1" class="min-w-[16rem] flex-1 rounded-sm border border-[#9eb2c1] px-2 py-1"></textarea>
                      </label>
                    </div>
                  }
                }
              </div>
            </section>

            <section>
              <h2 class="font-semibold text-ink">Features no aplicables</h2>
              <p class="mt-1 text-xs text-[#536875]">No se pueden editar ni guardar para este tipo de contenido.</p>
              <div class="mt-2 space-y-3 opacity-60">
                @for (feature of notApplicableFeatures(); track feature.featureKey) {
                  <div class="rounded-sm border border-[#d6e1e8] bg-[#eef3f6] p-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <strong class="text-ink">{{ feature.label }}</strong>
                      <span class="rounded-full bg-[#d6e1e8] px-2 py-0.5 text-[11px] font-semibold text-[#37505f]">no aplica</span>
                      <span class="font-mono text-[11px] text-[#567088]">{{ feature.featureKey }}</span>
                    </div>
                    <p class="mt-1 text-xs text-[#536875]">{{ feature.description }}</p>
                  </div>
                }
              </div>
            </section>

            <section class="rounded-sm border border-[#cad7df] bg-white p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="font-semibold text-ink">Tags</h2>
                <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-xs font-bold text-[#37505f] transition hover:bg-[#e6eef3]" (click)="toggleTagPaste()">{{ tagPasteOpen() ? 'Ocultar' : 'Pegar JSON' }}</button>
              </div>
              <p class="mt-1 text-xs text-[#536875]">Solo se pueden seleccionar tags de la taxonomía. Cada tag requiere strength y confidence.</p>
              <div class="relative mt-3" #tagPicker>
                <input
                  [ngModel]="tagQuery"
                  (ngModelChange)="tagQuery = $event"
                  (focus)="tagPickerActive.set(true)"
                  placeholder="Busca un género, tema o ambientación…"
                  class="w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                @if (tagPickerActive() && tagMatches().length > 0) {
                  <ul class="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-sm border border-[#9eb2c1] bg-white shadow">
                    @for (tag of tagMatches(); track tag.tagKey) {
                      <li>
                        <button type="button" (click)="selectTag(tag)" class="block w-full px-3 py-2 text-left text-sm hover:bg-[#eaf1f6]">
                          {{ tagLabel(tag) }} <small class="text-[#7d9ab0]">({{ TAG_TYPE_LABELS[tag.tagType] ?? tag.tagType }})</small>
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>

              @if (tagPasteOpen()) {
                <div class="mt-3 rounded-sm border border-[#cad7df] bg-white p-3">
                  <p class="text-xs text-[#536875]">Pega un objeto <code class="font-mono">&#123; "tagKey": &#123; "strength": 0.9, "confidence": 0.85 &#125; &#125;</code>. Los tags que ya estén se actualizan; los que no, se agregan desde la taxonomía. No se guarda en la base.</p>
                  <textarea [(ngModel)]="tagPasteJson" rows="8" placeholder='science_fiction: &#123; "strength": 0.9, "confidence": 0.85 &#125;, character_driven: …' class="mt-2 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2 font-mono text-xs"></textarea>
                  <div class="mt-2 flex gap-2">
                    <button type="button" class="rounded-sm bg-ink px-4 py-1.5 text-sm font-bold text-white hover:bg-ink-soft disabled:cursor-wait disabled:opacity-60" (click)="applyTagPaste()" [disabled]="busy()">Aplicar al formulario</button>
                    <button type="button" class="rounded-sm border border-[#7d9ab0] px-4 py-1.5 text-sm font-bold text-[#37505f] transition hover:bg-[#e6eef3]" (click)="closeTagPaste()">Cancelar</button>
                  </div>
                </div>
              }

              @if (ed.tags.length > 0) {
                <div class="mt-3 space-y-3">
                  @for (tag of ed.tags; track tag.tagKey) {
                    <div class="rounded-sm border border-[#d6e1e8] p-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <strong class="text-ink">{{ tagLabel(tag) }}</strong>
                        <span class="font-mono text-[11px] text-[#567088]">{{ tag.tagKey }}</span>
                        <span class="font-mono text-[11px] text-[#567088]">{{ TAG_TYPE_LABELS[tag.tagType] ?? tag.tagType }}</span>
                        <button type="button" class="text-[#52636f] hover:text-coral" aria-label="Quitar {{ tagLabel(tag) }}" (click)="removeTag(tag.tagKey)">×</button>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-4">
                        <label class="flex items-center gap-2 text-xs text-[#536875]">
                          strength
                          <input type="number" min="0" max="1" step="0.05" [ngModel]="tag.strength ?? ''" (ngModelChange)="onTagStrength(tag, $event)" class="w-24 rounded-sm border border-[#9eb2c1] px-2 py-1">
                        </label>
                        <label class="flex items-center gap-2 text-xs text-[#536875]">
                          confidence
                          <input type="number" min="0" max="0.95" step="0.05" [ngModel]="tag.confidence ?? ''" (ngModelChange)="onTagConfidence(tag, $event)" class="w-24 rounded-sm border border-[#9eb2c1] px-2 py-1">
                        </label>
                      </div>
                    </div>
                  }
                </div>
              }
            </section>
          } @else {
            <section>
              <h2 class="font-semibold text-ink">Features guardadas</h2>
              <div class="mt-2 grid gap-3 sm:grid-cols-2">
                @for (feature of savedFeatures(); track feature.featureKey) {
                  <div class="rounded-sm border border-[#d6e1e8] p-3">
                    <strong class="text-ink">{{ feature.label }}</strong>
                    <span class="ml-2 font-mono text-[11px] text-[#567088]">{{ feature.featureKey }}</span>
                    <p class="mt-1 text-sm text-[#37505f]">value {{ feature.value }} · confidence {{ feature.confidence }}</p>
                  </div>
                }
              </div>
            </section>
          }

          <details class="rounded-sm border border-[#cad7df] bg-white p-4">
            <summary class="cursor-pointer font-semibold text-ink">JSON técnico</summary>
            <pre class="mt-2 max-h-96 overflow-auto rounded-sm bg-[#142c3e] p-3 font-mono text-[11px] text-[#e4eff5]">{{ technicalJson() }}</pre>
          </details>
        </div>
      } @else if (loading()) {
        <p class="mt-8 font-mono text-xs uppercase tracking-wider text-[#7d9ab0]">Cargando…</p>
      }
    </div>
  `,
})
export class ClassificationEditorScreen implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly CONTENT_TYPES = CONTENT_TYPES;
  readonly TAG_LABELS = TAG_LABELS;
  readonly TAG_TYPE_LABELS = TAG_TYPE_LABELS;
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly tagPickerActive = signal(false);
  readonly editor = signal<ClassificationEditor | null>(null);
  readonly diagnostics = signal<ClassificationDiagnostics | null>(null);
  readonly pasteOpen = signal(false);
  pasteJson = '';
  readonly tagPasteOpen = signal(false);
  tagPasteJson = '';
  tagQuery = '';
  @ViewChild('tagPicker') private tagPicker: ElementRef<HTMLDivElement> | null = null;
  readonly aiClassifying = signal(false);
  readonly aiJobId = signal<string | null>(null);
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  @ViewChild('pdfInput') private pdfInput: ElementRef<HTMLInputElement> | null = null;
  @ViewChild('aiSection') private aiSection: ElementRef<HTMLElement> | null = null;

  ngOnDestroy(): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
  }

  constructor() {
    void this.load();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.tagPickerActive()) return;
    const target = event.target as Node | null;
    if (target && this.tagPicker?.nativeElement.contains(target)) return;
    this.tagPickerActive.set(false);
  }

  async load(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.toast.error('Falta la clasificación.');
      void this.router.navigate(['/app/admin']);
      return;
    }
    try {
      const [editor, diagnostics] = await Promise.all([
        this.api.getAdminClassificationEditor(id),
        this.api.getAdminClassificationDiagnostics(id),
      ]);
      this.editor.set(editor);
      this.diagnostics.set(diagnostics);
      const active = await this.api.getActiveAiJob(editor.id).catch(() => null);
      if (active && (active.status === 'pending' || active.status === 'processing')) {
        this.aiClassifying.set(true);
        this.aiJobId.set(active.id);
        this.pollAiJob(active.id);
      }
      if (this.route.snapshot.queryParamMap.get('ai') === '1') {
        setTimeout(() => this.aiSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      }
    } catch (error) {
      this.toast.error(this.message(error));
      void this.router.navigate(['/app/admin']);
    } finally {
      this.loading.set(false);
    }
  }

  requiredFeatures(): EditorFeature[] {
    return this.editor()?.features.filter((feature) => feature.requirement === 'required') ?? [];
  }

  optionalFeatures(): EditorFeature[] {
    return this.editor()?.features.filter((feature) => feature.requirement === 'optional') ?? [];
  }

  notApplicableFeatures(): EditorFeature[] {
    return this.editor()?.features.filter((feature) => feature.requirement === 'not_applicable') ?? [];
  }

  savedFeatures(): EditorFeature[] {
    return this.editor()?.features.filter((feature) => feature.value !== null) ?? [];
  }

  featureCard(feature: EditorFeature): { feature: EditorFeature } {
    return { feature };
  }

  onRangeValue(feature: EditorFeature, event: Event): void {
    feature.value = clamp((event.target as HTMLInputElement).value, 0, 1);
    this.bump();
  }

  onValueInput(feature: EditorFeature, raw: string | number | null): void {
    if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
      feature.value = null;
    } else {
      const parsed = Number(raw);
      feature.value = Number.isNaN(parsed) ? null : clamp(parsed, 0, 1);
    }
    this.bump();
  }

  onConfidenceInput(feature: EditorFeature, raw: string | number | null): void {
    if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
      feature.confidence = null;
    } else {
      const parsed = Number(raw);
      feature.confidence = Number.isNaN(parsed) ? null : clamp(parsed, 0, 0.95);
    }
    this.bump();
  }

  onNotesInput(feature: EditorFeature, raw: string | null): void {
    feature.notes = (raw ?? '').trim() === '' ? null : raw;
    this.bump();
  }

  onTagStrength(tag: EditorTag, raw: string | number | null): void {
    tag.strength = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '') ? null : clamp(Number(raw), 0, 1);
    this.bump();
  }

  onTagConfidence(tag: EditorTag, raw: string | number | null): void {
    tag.confidence = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '') ? null : clamp(Number(raw), 0, 0.95);
    this.bump();
  }

  async onChangeContentType(contentTypeKey: string): Promise<void> {
    const editor = this.editor();
    if (!editor || contentTypeKey === editor.contentTypeKey) return;
    try {
      const template = await this.api.getClassificationFeatureTemplate(contentTypeKey, editor.contentTypeSchemaVersion, editor.featureSchemaVersion);
      const current = new Map(editor.features.map((feature) => [feature.featureKey, feature]));
      editor.features = template.features.map((item) => {
        const existing = current.get(item.featureKey);
        return {
          ...item,
          value: existing?.value ?? null,
          confidence: existing?.confidence ?? null,
          notes: existing?.notes ?? null,
        };
      });
      editor.contentTypeKey = contentTypeKey;
      this.editor.set({ ...editor });
    } catch (error) {
      this.toast.error(this.message(error));
    }
  }

  tagMatches(): Tag[] {
    const editor = this.editor();
    if (!editor) return [];
    const query = this.searchText(this.tagQuery);
    const selected = new Set(editor.tags.map((tag) => tag.tagKey));
    return editor.tagsAvailable.filter(
      (tag) => !selected.has(tag.tagKey) && this.searchText(`${this.tagLabel(tag)} ${tag.name} ${tag.tagKey}`).includes(query),
    );
  }

  tagLabel(tag: Tag | EditorTag): string {
    return TAG_LABELS[tag.tagKey] ?? tag.name ?? tag.tagKey;
  }

  selectTag(tag: Tag): void {
    const editor = this.editor();
    if (!editor) return;
    if (editor.tags.some((item) => item.tagKey === tag.tagKey)) return;
    editor.tags = [...editor.tags, { tagKey: tag.tagKey, name: tag.name, tagType: tag.tagType, strength: null, confidence: null }];
    this.tagQuery = '';
    this.tagPickerActive.set(false);
    this.editor.set({ ...editor });
  }

  removeTag(tagKey: string): void {
    const editor = this.editor();
    if (!editor) return;
    editor.tags = editor.tags.filter((tag) => tag.tagKey !== tagKey);
    this.editor.set({ ...editor });
  }

  canApprove(): boolean {
    const editor = this.editor();
    const diagnostics = this.diagnostics();
    return Boolean(editor && editor.status === 'draft' && diagnostics && diagnostics.passes && !this.busy());
  }

  approveHint(): string {
    const diagnostics = this.diagnostics();
    if (diagnostics && !diagnostics.passes) return 'El diagnóstico no aprueba: faltan obligatorias o tags de género/tema.';
    return 'Aprueba la clasificación. Las opcionales pueden quedar vacías.';
  }

  async save(): Promise<void> {
    const editor = this.editor();
    if (!editor) return;
    const missingConfidence = editor.features.filter(
      (feature) => feature.requirement !== 'not_applicable' && feature.value !== null && feature.confidence === null,
    );
    if (missingConfidence.length > 0) {
      this.toast.error(`Falta confidence en: ${missingConfidence.map((feature) => feature.label).join(', ')}.`);
      return;
    }
    const incompleteTags = editor.tags.filter((tag) => tag.strength === null || tag.confidence === null);
    if (incompleteTags.length > 0) {
      this.toast.error(`Faltan strength/confidence en: ${incompleteTags.map((tag) => this.tagLabel(tag)).join(', ')}.`);
      return;
    }
    await this.run(async () => {
      const result = await this.api.saveAdminClassification(editor.id, {
        contentTypeKey: editor.contentTypeKey,
        contentTypeSchemaVersion: editor.contentTypeSchemaVersion,
        featureSchemaVersion: editor.featureSchemaVersion,
        tagTaxonomyVersion: editor.tagTaxonomyVersion,
        features: editor.features
          .filter((feature) => feature.requirement !== 'not_applicable')
          .map((feature) => ({ featureKey: feature.featureKey, value: feature.value, confidence: feature.confidence, notes: feature.notes ?? null })),
        tags: editor.tags.map((tag) => ({ tagKey: tag.tagKey, strength: tag.strength!, confidence: tag.confidence! })),
      });
      this.editor.set(result.classification);
      this.diagnostics.set(result.diagnostics);
      this.toast.success('Borrador guardado. Diagnóstico actualizado.');
    });
  }

  async approve(): Promise<void> {
    const editor = this.editor();
    if (!editor || !this.canApprove()) return;
    await this.run(async () => {
      await this.api.approveAdminClassification(editor.id);
      this.toast.success('Clasificación aprobada.');
      void this.router.navigate(['/app/admin']);
    });
  }

  async createCorrection(): Promise<void> {
    const editor = this.editor();
    if (!editor) return;
    await this.run(async () => {
      const corrected = await this.api.correctAdminClassification(editor.id);
      this.toast.success(`Revisión ${corrected.revision} creada con los valores precargados.`);
      void this.router.navigate(['/app/admin/clasificacion', corrected.id]);
    });
  }

  async discard(): Promise<void> {
    const editor = this.editor();
    if (!editor) return;
    await this.run(async () => {
      await this.api.deleteAdminClassification(editor.id);
      this.toast.success('Borrador descartado.');
      void this.router.navigate(['/app/admin']);
    });
  }

  technicalJson(): string {
    const editor = this.editor();
    const diagnostics = this.diagnostics();
    if (!editor) return '{}';
    return JSON.stringify(
      {
        classification: {
          id: editor.id,
          revision: editor.revision,
          status: editor.status,
          contentTypeKey: editor.contentTypeKey,
          contentTypeSchemaVersion: editor.contentTypeSchemaVersion,
          featureSchemaVersion: editor.featureSchemaVersion,
          tagTaxonomyVersion: editor.tagTaxonomyVersion,
          classifierVersion: editor.classifierVersion,
          features: editor.features.map((feature) => ({
            featureKey: feature.featureKey,
            requirement: feature.requirement,
            value: feature.value,
            confidence: feature.confidence,
            notes: feature.notes,
          })),
          tags: editor.tags,
        },
        diagnostics,
      },
      null,
      2,
    );
  }

  statusLabel(status: string): string {
    return status === 'draft' ? 'borrador' : status === 'approved' ? 'aprobada' : 'superada';
  }

  contentTypeLabel(key: string): string {
    return CONTENT_TYPES.find((contentType) => contentType.key === key)?.label ?? key;
  }

  back(): void {
    void this.router.navigate(['/app/admin']);
  }

  private bump(): void {
    const editor = this.editor();
    if (editor) this.editor.set({ ...editor });
  }

  togglePaste(): void {
    if (this.pasteOpen()) {
      this.closePaste();
      return;
    }
    this.pasteJson = '';
    this.pasteOpen.set(true);
  }

  async onPdfSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.toast.error('El archivo debe ser un PDF.');
      input.value = '';
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      this.toast.error('El PDF es demasiado grande (máximo 30 MB).');
      input.value = '';
      return;
    }
    const editor = this.editor();
    if (!editor) return;
    this.aiClassifying.set(true);
    try {
      const { jobId } = await this.api.aiClassifyPdf(editor.id, file);
      this.aiJobId.set(jobId);
      this.toast.success('PDF subido. El análisis corre en segundo plano y se guardará como borrador.');
      this.pollAiJob(jobId);
    } catch (error) {
      this.aiClassifying.set(false);
      this.aiJobId.set(null);
      this.toast.error(this.message(error));
    } finally {
      input.value = '';
    }
  }

  private pollAiJob(jobId: string): void {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    const tick = async () => {
      try {
        const job = await this.api.getAiJob(jobId);
        if (job.status === 'done') {
          this.aiClassifying.set(false);
          this.aiJobId.set(null);
          await this.load();
          this.toast.success('Propuesta IA guardada en el borrador. Revísala y aprueba cuando esté lista.');
        } else if (job.status === 'failed') {
          this.aiClassifying.set(false);
          this.aiJobId.set(null);
          this.toast.error(job.error ?? 'El análisis con IA falló.');
        } else {
          this.pollTimer = setTimeout(tick, 2000);
        }
      } catch (error) {
        this.aiClassifying.set(false);
        this.aiJobId.set(null);
        this.toast.error(this.message(error));
      }
    };
    void tick();
  }

  closePaste(): void {
    this.pasteOpen.set(false);
    this.pasteJson = '';
  }

  applyPaste(): void {
    const editor = this.editor();
    if (!editor) return;
    const trimmed = this.pasteJson.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      this.toast.error('JSON inválido. Revisa el formato.');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      this.toast.error('JSON inválido: se espera un objeto con claves de features.');
      return;
    }
    const record = parsed as Record<string, { value?: unknown; confidence?: unknown }>;
    const byKey = new Map(editor.features.map((feature) => [feature.featureKey, feature]));
    let applied = 0;
    for (const [featureKey, entry] of Object.entries(record)) {
      const feature = byKey.get(featureKey);
      if (!feature || feature.requirement === 'not_applicable') continue;
      if (!entry || typeof entry !== 'object') continue;
      const value = Number(entry.value);
      const confidence = Number(entry.confidence);
      if (!Number.isNaN(value)) feature.value = clamp(value, 0, 1);
      if (!Number.isNaN(confidence)) feature.confidence = clamp(confidence, 0, 0.95);
      applied++;
    }
    if (applied === 0) {
      this.toast.error('Ninguna feature del JSON coincide con el formulario.');
      return;
    }
    this.bump();
    this.toast.success(`${applied} features actualizadas en el formulario (no guardado).`);
    this.closePaste();
  }

  toggleTagPaste(): void {
    if (this.tagPasteOpen()) {
      this.closeTagPaste();
      return;
    }
    this.tagPasteJson = '';
    this.tagPasteOpen.set(true);
  }

  closeTagPaste(): void {
    this.tagPasteOpen.set(false);
    this.tagPasteJson = '';
  }

  applyTagPaste(): void {
    const editor = this.editor();
    if (!editor) return;
    const trimmed = this.tagPasteJson.trim();
    if (!trimmed) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      this.toast.error('JSON inválido. Revisa el formato.');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      this.toast.error('JSON inválido: se espera un objeto con claves de tags.');
      return;
    }
    const record = parsed as Record<string, { strength?: unknown; confidence?: unknown }>;
    const taxonomyByKey = new Map(editor.tagsAvailable.map((tag) => [tag.tagKey, tag]));
    const byKey = new Map(editor.tags.map((tag) => [tag.tagKey, tag]));
    const added: string[] = [];
    const updated: string[] = [];
    const unknown: string[] = [];
    for (const [tagKey, entry] of Object.entries(record)) {
      const taxonomy = taxonomyByKey.get(tagKey);
      if (!taxonomy) {
        unknown.push(tagKey);
        continue;
      }
      if (!entry || typeof entry !== 'object') continue;
      const strength = Number(entry.strength);
      const confidence = Number(entry.confidence);
      let tag = byKey.get(tagKey);
      if (!tag) {
        tag = { tagKey: taxonomy.tagKey, name: taxonomy.name, tagType: taxonomy.tagType, strength: null, confidence: null };
        editor.tags = [...editor.tags, tag];
        byKey.set(tagKey, tag);
        added.push(tagKey);
      } else {
        updated.push(tagKey);
      }
      if (!Number.isNaN(strength)) tag.strength = clamp(strength, 0, 1);
      if (!Number.isNaN(confidence)) tag.confidence = clamp(confidence, 0, 0.95);
    }
    if (added.length === 0 && updated.length === 0) {
      this.toast.error(unknown.length > 0 ? `Tags desconocidos para la taxonomía: ${unknown.join(', ')}.` : 'Ningún tag válido en el JSON.');
      return;
    }
    this.bump();
    const parts = [
      added.length > 0 ? `${added.length} agregados` : '',
      updated.length > 0 ? `${updated.length} actualizados` : '',
    ]
      .filter(Boolean)
      .join(', ');
    this.toast.success(`${parts} en el formulario (no guardado).${unknown.length > 0 ? ` Ignorados: ${unknown.join(', ')}.` : ''}`);
    this.closeTagPaste();
  }

  private searchText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await operation();
    } catch (error) {
      this.toast.error(this.message(error));
    } finally {
      this.busy.set(false);
    }
  }

  private message(error: unknown): string {
    const body = (error as { error?: { message?: unknown } }).error;
    if (typeof body?.message === 'string') return body.message;
    return error instanceof Error ? error.message : 'La operación no pudo completarse.';
  }
}
