import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminAssignment, AdminBook, AdminCandidate, AdminEdition, AdminFulfillment, AdminOrder, AdminScoreResult, ApiService, BookResult } from '../api.service';
import { DialogService } from '../dialog.service';
import { ToastService } from '../toast.service';
import { FULFILLMENT_LABELS } from '../components/order-timeline';
import { TAG_LABELS, TAG_TYPE_LABELS } from '../labels';

const CONTENT_TYPE_SCHEMA_VERSION = 'content-types/1.0';
const FEATURE_SCHEMA_VERSION = 'book-features/1.0';
const TAG_TAXONOMY_VERSION = 'tag-tax/1.0.1';

const notStartedReasons: Partial<Record<string, string>> = {
  no_time: 'No tuve tiempo',
  wrong_mood: 'No era el momento',
  read_something_else: 'Leí otra cosa',
  format_or_size: 'Formato o tamaño',
  did_not_attract_me: 'No me atrajo',
  other: 'Otro',
};

const outcomeAttributions: Partial<Record<string, string>> = {
  mostly_book: 'Principalmente el libro',
  mixed: 'Mezcla',
  mostly_timing: 'Principalmente el momento',
  external_circumstance: 'Circunstancia externa',
  no_problem: 'Nada en particular',
};

const completionLabels: Partial<Record<number, string>> = {
  5: 'Apenas lo empecé',
  18: 'Leí una parte',
  38: 'Menos de la mitad',
  63: 'Más de la mitad',
  88: 'Casi lo terminé',
  100: 'Lo terminé',
};

const aspectLabels: Partial<Record<string, string>> = {
  story_progress: 'El avance de la historia',
  tension_curiosity: 'La tensión o curiosidad',
  characters: 'Los personajes',
  writing_style: 'La forma de escribir',
  ideas_reflection: 'Las ideas o reflexiones',
  atmosphere: 'La atmósfera',
  slow_without_payoff: 'Fue lento sin una recompensa clara',
  confusing: 'Resultó confuso',
  style_too_ornate: 'El estilo fue demasiado recargado',
  too_much_introspection: 'Tuvo demasiada introspección',
  repetitive: 'Se sintió repetitivo',
  too_demanding: 'Exigía demasiado esfuerzo',
  topic_no_interest: 'No me interesó el tema',
};

@Component({
  selector: 'app-admin',
  imports: [FormsModule, DatePipe, CurrencyPipe],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p class="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Administración</p>
      <h1 class="mb-6 font-display text-4xl font-bold tracking-[-0.045em] text-ink sm:text-5xl">Catálogo y envíos</h1>

      <div class="mb-6 flex gap-2">
        <button type="button" class="rounded-sm border px-4 py-2 text-sm font-bold transition" [class.bg-ink]="tab()==='catalog'" [class.text-white]="tab()==='catalog'" [class.border-ink]="tab()==='catalog'" [class.border-[#7d9ab0]]="tab()!=='catalog'" (click)="selectTab('catalog')">Catálogo</button>
        <button type="button" class="rounded-sm border px-4 py-2 text-sm font-bold transition" [class.bg-ink]="tab()==='curation'" [class.text-white]="tab()==='curation'" [class.border-ink]="tab()==='curation'" [class.border-[#7d9ab0]]="tab()!=='curation'" (click)="selectTab('curation')">Curación</button>
        <button type="button" class="rounded-sm border px-4 py-2 text-sm font-bold transition" [class.bg-ink]="tab()==='orders'" [class.text-white]="tab()==='orders'" [class.border-ink]="tab()==='orders'" [class.border-[#7d9ab0]]="tab()!=='orders'" (click)="selectTab('orders')">Pedidos</button>
      </div>

      @if (tab() === 'catalog') {
        <section class="space-y-6">
          <div class="flex gap-3">
            <input [(ngModel)]="bookQuery" (keydown.enter)="loadBooks()" placeholder="Buscar libro…" class="w-full max-w-sm rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
            <button type="button" class="rounded-sm bg-ink px-5 py-2 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60" (click)="loadBooks()" [disabled]="loading()">Buscar</button>
          </div>

          <details class="rounded-sm border border-[#cad7df] bg-white p-4">
            <summary class="cursor-pointer font-semibold text-ink">Crear libro</summary>
            <div class="mt-3">
              <p class="mb-2 text-sm text-[#536875]">Busca el libro y elige el resultado para crearlo en el catálogo.</p>
              <div class="relative">
                <input
                  [(ngModel)]="newBookQuery"
                  (ngModelChange)="onNewBookQuery()"
                  placeholder="Busca un título (ej. la sombra del viento)"
                  [disabled]="creatingBook()"
                  class="w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2 disabled:cursor-wait disabled:opacity-60">
                @if (newBookResults().length > 0 && newBookQuery && !newBookSearch().loading && !newBookSearch().error && !creatingBook()) {
                  <ul class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-[#9eb2c1] bg-white">
                    @for (book of newBookResults(); track book.openLibraryId) {
                      <li>
                        <button type="button" (click)="createBookFromResult(book)" class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[#eaf1f6]">
                          @if (book.coverUrl) { <img [src]="book.coverUrl" alt="" class="h-12 w-8 shrink-0 object-cover"> } @else {
                            <div class="flex h-12 w-8 shrink-0 items-center justify-center border border-[#cad7df] bg-[#f2f6f9]">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-4 text-[#9eb2c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                            </div>
                          }
                          <span>
                            {{ book.title }}@if (book.authors.length) { — {{ book.authors.join(', ') }} }@if (book.firstPublishYear) { ({{ book.firstPublishYear }}) }
                          </span>
                        </button>
                      </li>
                    }
                  </ul>
                }
              </div>
              @if (creatingBook()) {
                <p class="mt-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#7d9ab0]">
                  <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Creando libro…
                </p>
              }
              @if (newBookQuery && newBookSearch().loading) {
                <p class="mt-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[#7d9ab0]">
                  <svg class="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Buscando…
                </p>
              }
              @if (newBookQuery && newBookSearch().error) {
                <div class="mt-2 flex items-center justify-between gap-3 rounded-sm border-l-[3px] border-coral bg-[#fbe9e6] px-3 py-2">
                  <p class="text-sm text-[#7a2c1f]">{{ newBookSearch().error }}</p>
                  <button type="button" (click)="retryNewBookSearch()" class="shrink-0 rounded-sm border border-[#7a2c1f] px-3 py-1 text-xs font-bold text-[#7a2c1f] transition hover:bg-[#f3d6cf]">Reintentar</button>
                </div>
              }
            </div>
          </details>

          @for (book of books(); track book.id) {
            <details class="rounded-sm border border-[#cad7df] bg-white p-4">
              <summary class="flex cursor-pointer items-center justify-between gap-3 font-semibold text-ink">
                <span>{{ book.canonicalTitle }} <span class="ml-2 font-mono text-xs text-[#567088]">{{ book.editions.length }} edición(es)</span></span>
                <span class="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-xs font-bold text-[#7a2c1f] transition hover:bg-[#fbe9e6] disabled:opacity-60"
                    (click)="deleteBook(book.id, book.canonicalTitle)"
                    [disabled]="loading()">Eliminar</button>
                </span>
              </summary>
              <div class="mt-3 space-y-3">
                <p class="text-sm text-[#536875]">Autores: {{ authorNames(book) }}</p>

                @for (edition of book.editions; track edition.id) {
                  <div class="rounded-sm border border-[#d6e1e8] p-3">
                    <p class="text-sm font-semibold text-ink">{{ edition.title }} <span class="font-mono text-xs text-[#567088]">{{ edition.languageCode }}</span></p>
                    @if (edition.pages || edition.isbn || edition.publisher || edition.publicationYear) {
                      <p class="mt-1 text-xs text-[#536875]">
                        @if (edition.pages) { {{ edition.pages }} páginas }@if (edition.pages && edition.isbn) { · }@if (edition.isbn) { ISBN {{ edition.isbn }} }@if (edition.publisher || edition.publicationYear) { · }@if (edition.publisher) { {{ edition.publisher }} }@if (edition.publicationYear) { ({{ edition.publicationYear }}) }
                      </p>
                    }
                    @if (edition.contributors.length > 0) {
                      <p class="text-xs text-[#536875]">Colaboradores: {{ contributorNames(edition) }}</p>
                    }
                    <details class="mt-2 rounded-sm border border-[#d6e1e8] p-2">
                      <summary class="cursor-pointer text-sm font-semibold text-ink">Crear clasificación manual</summary>
                      <div class="mt-2 flex flex-wrap items-center gap-2">
                        <select [(ngModel)]="newClassification.contentType" class="rounded-sm border border-[#9eb2c1] px-3 py-2">
                          <option value="fiction">Ficción</option>
                          <option value="narrative_nonfiction">No ficción narrativa</option>
                          <option value="expository_nonfiction">No ficción expositiva</option>
                          <option value="memoir">Memorias</option>
                          <option value="essay">Ensayo</option>
                          <option value="short_stories">Cuentos</option>
                          <option value="poetry">Poesía</option>
                          <option value="other">Otro</option>
                        </select>
                        <button type="button" class="rounded-sm bg-coral px-4 py-2 text-sm font-bold text-white hover:bg-coral-deep disabled:opacity-60" (click)="createManualClassification(edition.id)" [disabled]="loading()">Crear clasificación manual</button>
                      </div>
                      <p class="mt-2 text-xs text-[#536875]">Abre (o crea) un borrador y edita las features y tags manualmente antes de aprobar.</p>
                    </details>

                    <details class="mt-2 rounded-sm border border-[#d6e1e8] p-2">
                      <summary class="cursor-pointer text-sm font-semibold text-ink">Clasificar con IA (subir PDF)</summary>
                      <div class="mt-2">
                        <p class="text-xs text-[#536875]">Crea el borrador y, dentro del editor, sube el PDF del libro para que la IA proponga las features y tags automáticamente. Revisa antes de guardar y aprobar.</p>
                        <button type="button" class="mt-2 rounded-sm bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60" (click)="createAiClassification(edition.id)" [disabled]="loading()">Crear clasificación con IA</button>
                      </div>
                    </details>

                    @for (classification of edition.classifications; track classification.id) {
                      <div class="mt-2 border-t border-[#e3ebf0] pt-2 text-xs">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="font-mono text-[#567088]">rev {{ classification.revision }}</span>
                          <span class="font-mono text-[#567088]">{{ classification.status }}</span>
                          <span class="font-mono text-[#567088]">{{ classification.contentTypeKey }}</span>
                          @if (classification.status === 'draft') {
                            <button type="button" class="rounded-sm border border-[#9eb2c1] px-2 py-1 hover:bg-[#e6eef3]" (click)="openEditor(classification.id)">Editar</button>
                            <button type="button" class="rounded-sm border border-[#9eb2c1] px-2 py-1 text-[#7a2c1f] hover:bg-[#fbe9e6]" (click)="deleteClassification(classification.id)">Eliminar</button>
                          } @else {
                            <button type="button" class="rounded-sm border border-[#9eb2c1] px-2 py-1 hover:bg-[#e6eef3]" (click)="correct(classification.id)">Corregir</button>
                          }
                        </div>
                        @if (classification.tags.length > 0) {
                          <div class="mt-1.5 flex flex-wrap gap-1.5">
                            @for (tag of classification.tags; track tag.tagKey) {
                              <span class="inline-flex items-center rounded-full bg-[#eef3f6] px-2.5 py-0.5 text-[11px] text-ink">
                                {{ tagLabels[tag.tagKey] ?? tag.tagKey }}
                              </span>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            </details>
          }
        </section>
      }

      @if (tab() === 'curation') {
        <section class="space-y-4">
          <p class="text-sm text-[#536875]">Puntúa candidatos y asigna el libro a un fulfillment (el estado logístico vive en el fulfillment).</p>

          <div class="grid items-start gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <aside class="rounded-sm border border-[#cad7df] bg-white p-4">
              <h2 class="mb-3 font-semibold text-ink">Fulfillments pendientes</h2>
              @if (fulfillments().length > 0) {
                <div class="space-y-3">
                  @for (fulfillment of fulfillments(); track fulfillment.id) {
                    <div class="rounded-sm border border-[#d6e1e8] p-3">
                      <div class="flex items-center justify-between gap-2">
                        <div class="min-w-0">
                          <strong class="block truncate text-sm text-ink">{{ fulfillment.order.user.displayName || fulfillment.order.user.email || 'Sin nombre' }}</strong>
                          <span class="font-mono text-[11px] text-[#567088]">{{ fulfillment.order.packageName }}</span>
                        </div>
                        <span class="shrink-0 font-mono text-[11px] text-[#7d9ab0]">pedido {{ fulfillment.order.id.slice(0, 8) }}</span>
                      </div>
                      <button type="button" class="mt-2 rounded-sm bg-ink px-3 py-1 text-xs font-bold text-white hover:bg-ink-soft disabled:opacity-60" (click)="score(fulfillment.id)" [disabled]="loading()">Puntuar</button>
                      @if (scoredFor(fulfillment.id); as candidates) {
                        @for (candidate of candidates; track candidate.candidateId) {
                          <div class="mt-2 rounded-sm border border-[#e3ebf0] p-2">
                            <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                              <span class="font-mono text-[10px] text-[#567088]">#{{ candidate.rankPosition }}</span>
                              <strong class="text-ink">{{ candidate.title }}</strong>
                              <span class="font-mono text-[10px] text-[#567088]">score {{ (candidate.finalScore ?? 0).toFixed(4) }}</span>
                              @if (candidate.recommendationEvidenceCoverage !== null && candidate.recommendationEvidenceCoverage < 0.45) {
                                <span class="rounded-full bg-[#fbe9e6] px-2 py-0.5 text-[10px] font-semibold text-[#7a2c1f]">baja cobertura</span>
                              }
                            </p>
                            <button type="button" class="mt-2 rounded-sm bg-coral px-3 py-1 text-xs font-bold text-white hover:bg-coral-deep disabled:opacity-60" (click)="assignCandidate(fulfillment.id, candidate)" [disabled]="loading()">Asignar</button>
                            @if (candidate.explanation.reasons.length > 0 || candidate.explanation.tagMatches.length > 0) {
                              <details class="mt-1">
                                <summary class="cursor-pointer text-[11px] text-[#567088]">Desglose y explicación</summary>
                                <pre class="mt-1 max-h-48 overflow-auto rounded-sm bg-[#142c3e] p-2 font-mono text-[10px] text-[#e4eff5]">{{ breakdown(candidate) }}</pre>
                              </details>
                            }
                          </div>
                        }
                      }
                    </div>
                  }
                </div>
              } @else {
                <p class="text-sm text-[#7d9ab0]">No hay fulfillments pendientes.</p>
              }
            </aside>

            <div class="min-w-0 space-y-4">
              <div class="rounded-sm border border-[#cad7df] bg-white p-4">
                <h2 class="mb-1 font-semibold text-ink">Asignar libro a un pedido</h2>
                <p class="mb-3 text-sm text-[#536875]">Busca la persona con pedido activo y el libro del catálogo, y conéctalos sin puntuación.</p>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <span class="text-sm font-semibold text-ink">Pedido activo</span>
                    @if (selectedOrder(); as order) {
                      <div class="mt-1">
                        <div class="flex items-center justify-between gap-2 rounded-sm border border-[#9eb2c1] bg-[#f2f6f9] px-3 py-2">
                          <span class="min-w-0 truncate">
                            <strong class="block truncate text-ink">{{ order.user.displayName || order.user.email || 'Sin nombre' }}</strong>
                            <small class="text-[#566e80]">{{ order.packageName }} · {{ order.id.slice(0, 8) }} · {{ order.fulfillment?.status }}</small>
                          </span>
                          <button type="button" class="shrink-0 rounded-sm border border-[#7d9ab0] px-2 py-1 text-xs font-bold hover:bg-[#e6eef3]" (click)="clearOrder()">Cambiar</button>
                        </div>
                        @if (order.activeAssignment) {
                          <p class="mt-1 rounded-sm bg-[#fbe9e6] px-2 py-1 text-xs leading-snug text-[#7a2c1f]">Ya tiene un libro asignado; al reasignar se reemplazará.</p>
                        }
                      </div>
                    } @else {
                      <div class="relative">
                        <input
                          [(ngModel)]="assignOrderQuery"
                          (ngModelChange)="onOrderQuery()"
                          placeholder="Busca por nombre o correo…"
                          class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                        @if (assignOrderResults().length > 0 && !assignOrderSearch().loading && !assignOrderSearch().error) {
                          <ul class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-[#9eb2c1] bg-white shadow">
                            @for (order of assignOrderResults(); track order.id) {
                              <li>
                                <button type="button" (click)="pickOrder(order)" class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#eaf1f6]">
                                  <span class="min-w-0">
                                    <strong class="block truncate text-ink">{{ order.user.displayName || order.user.email || 'Sin nombre' }}</strong>
                                    <small class="text-[#566e80]">{{ order.packageName }} · {{ order.id.slice(0, 8) }}</small>
                                  </span>
                                  <span class="shrink-0 font-mono text-xs text-[#7d9ab0]">{{ order.fulfillment?.status }}</span>
                                </button>
                              </li>
                            }
                          </ul>
                        }
                      </div>
                    }
                  </div>
                  <div>
                    <span class="text-sm font-semibold text-ink">Libro del catálogo</span>
                    @if (selectedBook(); as book) {
                      <div class="mt-1 flex items-center justify-between gap-2 rounded-sm border border-[#9eb2c1] bg-[#f2f6f9] px-3 py-2">
                        <span class="min-w-0 truncate">
                          <strong class="block truncate text-ink">{{ book.canonicalTitle }}</strong>
                          <small class="text-[#566e80]">{{ authorNames(book) }}</small>
                        </span>
                        <button type="button" class="shrink-0 rounded-sm border border-[#7d9ab0] px-2 py-1 text-xs font-bold hover:bg-[#e6eef3]" (click)="clearBook()">Cambiar</button>
                      </div>
                    } @else {
                      <div class="relative">
                        <input
                          [(ngModel)]="assignBookQuery"
                          (ngModelChange)="onBookQuery()"
                          placeholder="Busca un título…"
                          class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                        @if (assignBookResults().length > 0 && !assignBookSearch().loading && !assignBookSearch().error) {
                          <ul class="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-[#9eb2c1] bg-white shadow">
                            @for (book of assignBookResults(); track book.id) {
                              <li>
                                <button type="button" (click)="pickBook(book)" class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#eaf1f6]">
                                  <span class="min-w-0">
                                    <strong class="block truncate text-ink">{{ book.canonicalTitle }}</strong>
                                    <small class="text-[#566e80]">{{ authorNames(book) }}</small>
                                  </span>
                                </button>
                              </li>
                            }
                          </ul>
                        }
                      </div>
                    }
                  </div>
                </div>

                @if (selectedBook(); as book) {
                  <label class="mt-3 block">
                    <span class="text-sm font-semibold text-ink">Edición (clasificación aprobada)</span>
                    <select [(ngModel)]="assignEditionId" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                      <option value="">Selecciona…</option>
                      @for (edition of assignableEditions(); track edition.id) {
                        <option [value]="edition.id">{{ edition.title }} ({{ edition.languageCode }})</option>
                      }
                    </select>
                  </label>
                }

                <div class="mt-3">
                  <button
                    type="button"
                    class="rounded-sm bg-coral px-5 py-2 text-sm font-bold text-white transition hover:bg-coral-deep disabled:cursor-wait disabled:opacity-60"
                    (click)="assignDirect()"
                    [disabled]="loading() || !selectedOrder() || !selectedBook() || !assignEditionId()">
                    {{ selectedOrder()?.activeAssignment ? 'Reasignar libro' : 'Asignar libro' }}
                  </button>
                </div>
              </div>

              @for (assignment of assignments(); track assignment.id) {
            <div class="rounded-sm border border-[#cad7df] bg-white p-4">
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div class="min-w-0">
                  <strong class="block text-ink">{{ assignment.fulfillment.order.user.displayName || assignment.fulfillment.order.user.email || 'Sin nombre' }}</strong>
                  @if (assignment.fulfillment.order.user.email) {
                    <small class="text-[#566e80]">{{ assignment.fulfillment.order.user.email }}</small>
                  }
                </div>
                <span class="font-mono text-xs text-[#567088]">{{ assignment.edition.title }}</span>
                <span class="font-mono text-xs text-[#567088]">fulfillment: {{ assignment.fulfillment.status }}</span>
                <span class="font-mono text-xs text-[#567088]">ciclo: {{ assignment.feedbackCycleStatus }}</span>
                <span class="font-mono text-xs text-[#567088]">rev {{ assignment.classification.revision }}</span>
                <button type="button" class="ml-auto shrink-0 rounded-sm border border-[#7d9ab0] px-3 py-1 text-xs font-bold hover:bg-[#e6eef3]" (click)="openReader(assignment.fulfillment.order.user.id)">Ver lector</button>
              </div>
              @if (assignment.notes) {
                <p class="mt-2 rounded-sm bg-[#f2f6f9] px-3 py-2 text-xs leading-relaxed text-[#536875]">
                  <span class="font-semibold text-ink">Nota:</span> {{ assignment.notes }}
                </p>
              }
              @if (invitationUrl() && invitationFor() === assignment.id) {
                <p class="mt-2 break-all rounded-sm bg-[#e2f0e9] px-3 py-2 text-sm text-[#16442f]">Invitación: <a class="underline" [href]="invitationUrl()" target="_blank">{{ invitationUrl() }}</a></p>
              }
              <div class="mt-2 flex flex-wrap gap-2">
                @if (assignment.fulfillment.status === 'assigned') {
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="startReplace(assignment.id)">Reasignar</button>
                  <button type="button" class="rounded-sm bg-ink px-3 py-1 text-sm font-bold text-white hover:bg-ink-soft" (click)="action('pack', assignment.id)">Empaquetar</button>
                }
                @if (assignment.fulfillment.status === 'packed') {
                  <button type="button" class="rounded-sm bg-coral px-3 py-1 text-sm font-bold text-white" (click)="action('ship', assignment.id)">Enviar</button>
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('unpack', assignment.id)">Deshacer empaquetado</button>
                }
                @if (assignment.fulfillment.status === 'shipped') {
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('in-delivery', assignment.id)">Marcar en proceso de entrega</button>
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('unship', assignment.id)">Deshacer envío</button>
                }
                @if (assignment.fulfillment.status === 'in_delivery') {
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('delivered', assignment.id)">Marcar entregado</button>
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('undo-in-delivery', assignment.id)">Deshacer en proceso de entrega</button>
                }
                @if (assignment.fulfillment.status === 'delivered') {
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('undo-delivered', assignment.id)">Deshacer entregado</button>
                }
                @if (['invited', 'provisional_received'].includes(assignment.feedbackCycleStatus)) {
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('reissue-invitation', assignment.id)">Ver invitación</button>
                  @if (assignment.feedbacks.length === 0) {
                    <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('close-without-feedback', assignment.id)">Cerrar sin feedback</button>
                  }
                }
                @if (['final_received', 'closed_without_feedback'].includes(assignment.feedbackCycleStatus)) {
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="reopenLearning(assignment.id)">Reabrir aprendizaje</button>
                }
              </div>
              @if (replaceTarget() === assignment.id) {
                @if (replacementCandidates(assignment); as candidates) {
                  @if (candidates.length > 0) {
                    <div class="mt-3 rounded-sm border border-[#d6e1e8] p-3">
                      <p class="mb-2 text-xs font-semibold text-ink">Elige el reemplazo</p>
                      @for (candidate of candidates; track candidate.candidateId) {
                        <div class="flex flex-wrap items-center gap-3 border-t border-[#e3ebf0] py-2 text-sm">
                          <span class="font-mono text-xs text-[#567088]">#{{ candidate.rankPosition }}</span>
                          <strong class="text-ink">{{ candidate.title }}</strong>
                          <span class="font-mono text-xs text-[#567088]">score {{ (candidate.finalScore ?? 0).toFixed(4) }}</span>
                          <button type="button" class="rounded-sm bg-coral px-3 py-1 text-sm font-bold text-white" (click)="replaceWithCandidate(assignment.id, candidate)">Usar este</button>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="mt-3 rounded-sm border border-[#d6e1e8] p-3">
                      <p class="text-sm text-[#536875]">No hay otro libro para asignar en la recomendación actual. Puedes reasignar desde «Asignar libro a un pedido».</p>
                    </div>
                  }
                }
              }
              @if (assignment.feedbacks.length > 0) {
                <div class="mt-3 space-y-2">
                  @for (feedback of assignment.feedbacks; track feedback.id) {
                    <div class="rounded-sm border border-[#d6e1e8] bg-[#f7fafc] px-3 py-2 text-xs leading-relaxed text-[#536875]">
                      <div class="flex flex-wrap items-center gap-2">
                        <strong class="text-ink">{{ feedback.isFinal ? 'Feedback final' : 'Feedback provisional' }}</strong>
                        <span>{{ feedback.submittedAt | date:'short' }}</span>
                        @if (feedback.selectionFitRating !== null) {
                          <span class="font-bold text-ink">Selección: {{ feedback.selectionFitRating }}/5</span>
                        }
                      </div>
                      <div class="mt-1">
                        @if (!feedback.started) {
                          <span>No lo empezó — {{ notStartedReasons[feedback.notStartedReason ?? ''] ?? feedback.notStartedReason ?? '—' }}</span>
                        } @else {
                          <span>{{ feedback.readingStatus === 'completed' ? 'Lo terminó' : (completionLabels[feedback.completionPercentage] ?? feedback.completionPercentage + '%') }} ({{ feedback.completionPercentage }}%)</span>
                        }
                        @if (feedback.outcomeAttribution) {
                          <span class="ml-2">· Atribución: {{ outcomeAttributions[feedback.outcomeAttribution] ?? feedback.outcomeAttribution }}</span>
                        }
                      </div>
                      @if (feedback.aspects.length > 0) {
                        <div class="mt-1">
                          @for (aspect of feedback.aspects; track aspect.optionKey) {
                            <span
                              class="mr-1 inline-block rounded-full px-2 py-0.5"
                              [class.bg-[#e2f0e9]]="aspect.polarity === 'positive'"
                              [class.text-[#16442f]]="aspect.polarity === 'positive'"
                              [class.bg-[#fbe9e6]]="aspect.polarity === 'negative'"
                              [class.text-[#7a2c1f]]="aspect.polarity === 'negative'"
                            >{{ aspectLabel(aspect.optionKey) }}</span>
                          }
                        </div>
                      }
                      @if (feedback.freeText) {
                        <p class="mt-1 whitespace-pre-wrap rounded-sm bg-white px-2 py-1">«{{ feedback.freeText }}»</p>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
          @if (assignments().length === 0 && !loading()) {
            <p class="text-sm text-[#7d9ab0]">No hay asignaciones.</p>
          }
            </div>
          </div>
        </section>
      }

      @if (tab() === 'orders') {
        <section class="space-y-4">
          <div class="rounded-sm border border-[#cad7df] bg-white p-4">
            <h2 class="font-semibold text-ink">Crear pedido administrativo sin cobro</h2>
            <p class="mt-1 text-sm text-[#536875]">Selecciona un usuario para iniciar su pedido directamente en curación, sin abrir Stripe Checkout ni registrar un pago.</p>

            @if (selectedAdminUser(); as user) {
              <div class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#9eb2c1] bg-[#f2f6f9] px-3 py-2">
                <span class="min-w-0">
                  <strong class="block truncate text-ink">{{ user.displayName || user.email || 'Sin nombre' }}</strong>
                  @if (user.email) { <small class="text-[#566e80]">{{ user.email }}</small> }
                </span>
                <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-xs font-bold hover:bg-[#e6eef3]" (click)="clearAdminUser()">Cambiar</button>
              </div>
            } @else {
              <div class="relative mt-3">
                <input
                  [(ngModel)]="adminUserQuery"
                  (ngModelChange)="onAdminUserQuery()"
                  placeholder="Buscar por nombre o correo…"
                  class="w-full max-w-md rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                @if (adminUserResults().length > 0 && !adminUserSearch().loading && !adminUserSearch().error) {
                  <ul class="absolute z-10 mt-1 max-h-60 w-full max-w-md overflow-y-auto rounded-sm border border-[#9eb2c1] bg-white shadow">
                    @for (user of adminUserResults(); track user.id) {
                      <li>
                        <button type="button" class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[#eaf1f6]" (click)="pickAdminUser(user)">
                          <span class="min-w-0">
                            <strong class="block truncate text-ink">{{ user.displayName || user.email || 'Sin nombre' }}</strong>
                            @if (user.email) { <small class="text-[#566e80]">{{ user.email }}</small> }
                          </span>
                          <span class="shrink-0 font-mono text-[11px] text-[#567088]">{{ user._count.orders }} pedido(s)</span>
                        </button>
                      </li>
                    }
                  </ul>
                }
                @if (adminUserSearch().loading) {
                  <p class="mt-2 text-xs text-[#7d9ab0]">Buscando usuarios…</p>
                }
                @if (adminUserSearch().error) {
                  <p class="mt-2 text-xs text-[#7a2c1f]">{{ adminUserSearch().error }}</p>
                }
              </div>
            }

            <button
              type="button"
              class="mt-3 rounded-sm bg-coral px-4 py-2 text-sm font-bold text-white hover:bg-coral-deep disabled:opacity-60"
              [disabled]="loading() || !selectedAdminUser()"
              (click)="createFreeAdminOrder()">
              Crear pedido sin cobro
            </button>
          </div>

          <div class="flex gap-3">
            <input [(ngModel)]="orderQuery" (keydown.enter)="loadOrders()" placeholder="Buscar por persona…" class="w-full max-w-sm rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
            <select [(ngModel)]="orderStatus" (change)="loadOrders()" class="rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
              <option value="">Todos los estados</option>
              @for (option of orderStatusOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
            <button type="button" class="rounded-sm bg-ink px-5 py-2 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60" (click)="loadOrders()" [disabled]="loading()">Buscar</button>
          </div>

          @if (orders().length > 0) {
            @for (order of orders(); track order.id) {
              <div class="rounded-sm border border-[#cad7df] bg-white p-4">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <strong class="text-ink">{{ order.user.displayName || order.user.email || 'Sin nombre' }}</strong>
                  <span class="font-mono text-xs text-[#567088]">{{ order.packageName }}</span>
                  <span class="font-mono text-xs text-[#567088]">{{ order.totalCents / 100 | currency:'MXN':'$':'1.0-0' }}</span>
                  <span class="font-mono text-xs text-[#567088]">{{ order.createdAt | date:'short' }}</span>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#536875]">
                  <span>Envío: <strong class="text-ink">{{ fulfillmentLabel(order) }}</strong></span>
                  <span>Pago: {{ order.payment?.status ?? '—' }}</span>
                  <span>Feedback: {{ order._count.feedbacks }}</span>
                  <span>Pedido: {{ order.id.slice(0, 8) }}</span>
                </div>
                @if (order.shippingAddress; as address) {
                  <div class="mt-3 rounded-sm border border-[#d6e1e8] bg-[#f7fafc] px-3 py-2 text-xs text-[#536875]">
                    <p class="font-semibold text-ink">Envío a: {{ address.recipientName }}</p>
                    <p>
                      {{ address.street }}{{ address.exteriorNumber ? ' ' + address.exteriorNumber : '' }}{{ address.interiorNumber ? ' int. ' + address.interiorNumber : '' }}{{ address.neighborhood ? ', ' + address.neighborhood : '' }},
                      {{ address.city }}, {{ address.state }} {{ address.postalCode }}
                    </p>
                    @if (order.user.email) { <p>Correo: {{ order.user.email }}</p> }
                    @if (address.phone) { <p>Teléfono: {{ address.phone }}</p> }
                  </div>
                }
                @if (order.fulfillment) {
                  <div class="mt-3 flex flex-wrap gap-2">
                    @if (order.fulfillment.status === 'curation_pending') {
                      <button type="button" class="rounded-sm bg-ink px-3 py-1 text-sm font-bold text-white hover:bg-ink-soft" (click)="goToCuration()">Seleccionar libro</button>
                    }
                    @if (order.fulfillment.status === 'assigned' && order.activeAssignment) {
                      <button type="button" class="rounded-sm bg-ink px-3 py-1 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60" [disabled]="loading()" (click)="fulfillAction('pack', order)">Empaquetar</button>
                    }
                    @if (order.fulfillment.status === 'packed' && order.activeAssignment) {
                      <button type="button" class="rounded-sm bg-coral px-3 py-1 text-sm font-bold text-white hover:bg-coral-deep disabled:opacity-60" [disabled]="loading()" (click)="fulfillAction('ship', order)">Enviar</button>
                    }
                    @if (order.fulfillment.status === 'shipped' && order.activeAssignment) {
                      <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3] disabled:opacity-60" [disabled]="loading()" (click)="fulfillAction('in-delivery', order)">Marcar en proceso de entrega</button>
                    }
                    @if (order.fulfillment.status === 'in_delivery' && order.activeAssignment) {
                      <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3] disabled:opacity-60" [disabled]="loading()" (click)="fulfillAction('delivered', order)">Marcar entregado</button>
                    }
                    <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="openReader(order.user.id)">Ver lector</button>
                  </div>
                }
              </div>
            }
          } @else if (!loading()) {
            <p class="text-sm text-[#7d9ab0]">No hay pedidos.</p>
          }
        </section>
      }
    </div>
  `,
})
export class AdminScreen {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(DialogService);

  readonly tab = signal<'catalog' | 'curation' | 'orders'>('catalog');
  readonly books = signal<AdminBook[]>([]);
  readonly assignments = signal<AdminAssignment[]>([]);
  readonly fulfillments = signal<AdminFulfillment[]>([]);
  readonly orders = signal<AdminOrder[]>([]);
  readonly adminUserResults = signal<AdminUser[]>([]);
  readonly adminUserSearch = signal<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  readonly selectedAdminUser = signal<AdminUser | null>(null);
  readonly scored = signal<Record<string, AdminCandidate[]>>({});
  readonly replaceTarget = signal<string | null>(null);
  readonly loading = signal(false);
  readonly selectedOrder = signal<AdminOrder | null>(null);
  readonly selectedBook = signal<AdminBook | null>(null);
  readonly assignEditionId = signal('');
  readonly assignOrderResults = signal<AdminOrder[]>([]);
  readonly assignOrderSearch = signal<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  readonly assignBookResults = signal<AdminBook[]>([]);
  readonly assignBookSearch = signal<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  assignOrderQuery = '';
  assignBookQuery = '';
  private orderTimer: ReturnType<typeof setTimeout> | null = null;
  private orderSeq = 0;
  private adminUserTimer: ReturnType<typeof setTimeout> | null = null;
  private adminUserSeq = 0;
  private bookTimer: ReturnType<typeof setTimeout> | null = null;
  private bookSeq = 0;

  readonly assignableEditions = computed(() => {
    const book = this.selectedBook();
    return book?.editions.filter((edition) => edition.classifications.some((classification) => classification.status === 'approved')) ?? [];
  });
  readonly invitationUrl = signal<string | null>(null);
  readonly invitationFor = signal<string | null>(null);
  private readonly confirmations: Record<string, { title: string; message: string; confirmLabel: string; danger?: boolean }> = {
    pack: { title: 'Empaquetar pedido', message: '¿Marcar el pedido como empaquetado?', confirmLabel: 'Empaquetar' },
    ship: { title: 'Enviar pedido', message: 'Al enviar se genera la invitación de feedback (QR). ¿Continuar?', confirmLabel: 'Enviar' },
    'in-delivery': { title: 'Marcar en proceso de entrega', message: '¿Marcar el pedido como en proceso de entrega?', confirmLabel: 'Marcar' },
    delivered: { title: 'Marcar entregado', message: '¿Confirmar que el libro fue entregado?', confirmLabel: 'Marcar entregado' },
    'close-without-feedback': { title: 'Cerrar sin feedback', message: 'Se cierra el ciclo de aprendizaje y se revocan las invitaciones pendientes. Puedes reabrirlo después. ¿Continuar?', confirmLabel: 'Cerrar ciclo', danger: true },
    unpack: { title: 'Deshacer empaquetado', message: '¿Regresar el pedido de "empaquetado" a "asignado"?', confirmLabel: 'Deshacer' },
    unship: { title: 'Deshacer envío', message: 'El pedido regresa a "empaquetado" y se revoca la invitación (QR) generada. ¿Continuar?', confirmLabel: 'Deshacer', danger: true },
    'undo-in-delivery': { title: 'Deshacer en proceso de entrega', message: '¿Regresar el pedido de "en proceso de entrega" a "enviado"?', confirmLabel: 'Deshacer' },
    'undo-delivered': { title: 'Deshacer entregado', message: '¿Regresar el pedido de "entregado" a "en proceso de entrega"?', confirmLabel: 'Deshacer' },
  };
  readonly orderStatusOptions = [
    { value: 'curation_pending', label: 'Orden recibida' },
    { value: 'assigned', label: 'Selección de libro' },
    { value: 'packed', label: 'Preparación de orden' },
    { value: 'shipped', label: 'Enviado' },
    { value: 'in_delivery', label: 'En proceso de entrega' },
    { value: 'delivered', label: 'Entregado' },
    { value: 'canceled', label: 'Cancelado' },
  ];

  bookQuery = '';
  orderQuery = '';
  orderStatus = '';
  adminUserQuery = '';
  newBookQuery = '';
  newClassification = { contentType: 'fiction' };
  readonly tagLabels = TAG_LABELS;
  readonly tagTypeLabels = TAG_TYPE_LABELS;
  readonly notStartedReasons = notStartedReasons;
  readonly outcomeAttributions = outcomeAttributions;
  readonly completionLabels = completionLabels;
  readonly newBookResults = signal<BookResult[]>([]);
  readonly newBookSearch = signal<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  readonly creatingBook = signal(false);
  private newBookTimer: ReturnType<typeof setTimeout> | null = null;
  private newBookSeq = 0;

  constructor() {
    const requested = this.route.snapshot.queryParamMap.get('tab');
    if (requested === 'catalog' || requested === 'curation' || requested === 'orders') {
      this.tab.set(requested);
    }
    void this.loadBooks();
    if (this.tab() === 'curation') void this.loadAssignments();
    if (this.tab() === 'orders') void this.loadOrders();
  }

  aspectLabel(key: string): string {
    return aspectLabels[key] ?? key;
  }

  selectTab(tab: 'catalog' | 'curation' | 'orders'): void {
    this.tab.set(tab);
    void this.router.navigate(['/app/admin'], { queryParams: { tab } });
    if (tab === 'curation') void this.loadAssignments();
    if (tab === 'orders') void this.loadOrders();
  }

  async loadOrders(): Promise<void> {
    await this.run(async () => {
      this.orders.set(await this.api.listAdminOrders(this.orderQuery, this.orderStatus));
    });
  }

  onAdminUserQuery(): void {
    if (this.adminUserTimer) clearTimeout(this.adminUserTimer);
    if (!this.adminUserQuery.trim()) {
      this.adminUserSeq++;
      this.adminUserResults.set([]);
      this.adminUserSearch.set({ loading: false, error: null });
      return;
    }
    this.adminUserTimer = setTimeout(() => this.runAdminUserSearch(this.adminUserQuery), 300);
  }

  private runAdminUserSearch(query: string): void {
    const seq = ++this.adminUserSeq;
    this.adminUserSearch.set({ loading: true, error: null });
    this.api.listAdminUsers(query).then((users) => {
      if (seq !== this.adminUserSeq) return;
      this.adminUserResults.set(users);
      this.adminUserSearch.set({ loading: false, error: null });
    }).catch(() => {
      if (seq !== this.adminUserSeq) return;
      this.adminUserResults.set([]);
      this.adminUserSearch.set({ loading: false, error: 'No pudimos buscar usuarios.' });
    });
  }

  pickAdminUser(user: AdminUser): void {
    this.selectedAdminUser.set(user);
    this.adminUserQuery = '';
    this.adminUserResults.set([]);
    this.adminUserSearch.set({ loading: false, error: null });
  }

  clearAdminUser(): void {
    this.selectedAdminUser.set(null);
  }

  async createFreeAdminOrder(): Promise<void> {
    const user = this.selectedAdminUser();
    if (!user) return;
    const name = user.displayName || user.email || 'este usuario';
    const confirmed = await this.dialog.confirm({
      title: 'Crear pedido sin cobro',
      message: `Se creará un pedido administrativo para ${name}. No se abrirá Stripe Checkout ni se registrará un pago. ¿Continuar?`,
      confirmLabel: 'Crear pedido',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    await this.run(async () => {
      await this.api.createAdminOrder(user.id);
      this.toast.success('Pedido administrativo creado y enviado a curación.');
      this.clearAdminUser();
      await this.loadOrders();
    });
  }

  async fulfillAction(action: 'pack' | 'ship' | 'in-delivery' | 'delivered', order: AdminOrder): Promise<void> {
    if (!order.activeAssignment) return;
    const assignmentId = order.activeAssignment.id;
    const confirm = this.confirmations[action];
    if (confirm) {
      const confirmed = await this.dialog.confirm({ title: confirm.title, message: confirm.message, confirmLabel: confirm.confirmLabel, cancelLabel: 'Cancelar', danger: confirm.danger });
      if (!confirmed) return;
    }
    await this.run(async () => {
      await this.api.adminAction(action, assignmentId);
      this.toast.success(action === 'pack' ? 'Pedido empacado.' : action === 'ship' ? 'Pedido enviado.' : 'Pedido marcado como entregado.');
      await this.loadOrders();
    });
  }

  goToCuration(): void {
    this.selectTab('curation');
  }

  openReader(userId: string): void {
    void this.router.navigate(['/app/lectores'], { queryParams: { userId } });
  }

  fulfillmentLabel(order: AdminOrder): string {
    const status = order.fulfillment?.status ?? '';
    return FULFILLMENT_LABELS[status] ?? (status || '—');
  }

  async loadBooks(): Promise<void> {
    await this.run(async () => {
      this.books.set(await this.api.listAdminBooks(this.bookQuery));
    });
  }

  async loadAssignments(): Promise<void> {
    await this.run(async () => {
      const [assignments, fulfillments] = await Promise.all([this.api.listAdminAssignments(), this.api.listAdminFulfillments()]);
      this.assignments.set(assignments);
      this.fulfillments.set(fulfillments.filter((fulfillment) => fulfillment.status === 'curation_pending'));
    });
  }

  scoredFor(fulfillmentId: string): AdminCandidate[] | null {
    return this.scored()[fulfillmentId] ?? null;
  }

  async score(fulfillmentId: string): Promise<void> {
    await this.run(async () => {
      const result: AdminScoreResult = await this.api.scoreFulfillment(fulfillmentId);
      this.scored.update((current) => ({ ...current, [fulfillmentId]: result.candidates }));
    });
  }

  async assignCandidate(fulfillmentId: string, candidate: AdminCandidate): Promise<void> {
    const reason = await this.dialog.prompt({
      title: 'Asignar libro',
      message: `Se asignará «${candidate.title}» a este pedido.`,
      inputLabel: 'Razón de la selección (opcional)',
      placeholder: 'Opcional',
      confirmLabel: 'Asignar',
    });
    if (reason === null) return;
    await this.run(async () => {
      await this.api.adminAssign(fulfillmentId, {
        bookEditionId: candidate.bookEditionId,
        classificationVersionId: candidate.classificationVersionId,
        candidateId: candidate.candidateId,
        reason: reason || undefined,
      });
      this.toast.success(`Asignado: ${candidate.title}`);
      await this.loadAssignments();
    });
  }

  onOrderQuery(): void {
    if (this.orderTimer) clearTimeout(this.orderTimer);
    if (!this.assignOrderQuery.trim()) {
      this.orderSeq++;
      this.assignOrderResults.set([]);
      this.assignOrderSearch.set({ loading: false, error: null });
      return;
    }
    this.orderTimer = setTimeout(() => this.runOrderSearch(this.assignOrderQuery), 300);
  }

  private runOrderSearch(query: string): void {
    const seq = ++this.orderSeq;
    this.assignOrderSearch.set({ loading: true, error: null });
    this.api.listAdminOrders(query).then((orders) => {
      if (seq !== this.orderSeq) return;
      const eligible = orders.filter((order) => order.fulfillment && (order.fulfillment.status === 'curation_pending' || order.fulfillment.status === 'assigned'));
      this.assignOrderResults.set(eligible);
      this.assignOrderSearch.set({ loading: false, error: null });
    }).catch(() => {
      if (seq !== this.orderSeq) return;
      this.assignOrderResults.set([]);
      this.assignOrderSearch.set({ loading: false, error: 'No pudimos buscar pedidos.' });
    });
  }

  pickOrder(order: AdminOrder): void {
    this.selectedOrder.set(order);
    this.assignOrderQuery = '';
    this.assignOrderResults.set([]);
    this.assignOrderSearch.set({ loading: false, error: null });
  }

  clearOrder(): void {
    this.selectedOrder.set(null);
  }

  onBookQuery(): void {
    if (this.bookTimer) clearTimeout(this.bookTimer);
    if (!this.assignBookQuery.trim()) {
      this.bookSeq++;
      this.assignBookResults.set([]);
      this.assignBookSearch.set({ loading: false, error: null });
      return;
    }
    this.bookTimer = setTimeout(() => this.runBookSearch(this.assignBookQuery), 300);
  }

  private runBookSearch(query: string): void {
    const seq = ++this.bookSeq;
    this.assignBookSearch.set({ loading: true, error: null });
    this.api.listAdminBooks(query).then((books) => {
      if (seq !== this.bookSeq) return;
      const eligible = books.filter((book) => book.editions.some((edition) => edition.classifications.some((classification) => classification.status === 'approved')));
      this.assignBookResults.set(eligible);
      this.assignBookSearch.set({ loading: false, error: null });
    }).catch(() => {
      if (seq !== this.bookSeq) return;
      this.assignBookResults.set([]);
      this.assignBookSearch.set({ loading: false, error: 'No pudimos buscar libros.' });
    });
  }

  pickBook(book: AdminBook): void {
    this.selectedBook.set(book);
    this.assignBookQuery = '';
    this.assignBookResults.set([]);
    this.assignBookSearch.set({ loading: false, error: null });
    this.assignEditionId.set('');
  }

  clearBook(): void {
    this.selectedBook.set(null);
    this.assignEditionId.set('');
  }

  async assignDirect(): Promise<void> {
    const order = this.selectedOrder();
    const book = this.selectedBook();
    const edition = this.assignableEditions().find((item) => item.id === this.assignEditionId());
    const fulfillmentId = order?.fulfillment?.id;
    if (!order || !book || !fulfillmentId || !edition) return;
    const approved = [...edition.classifications].filter((classification) => classification.status === 'approved').sort((a, b) => b.revision - a.revision)[0];
    if (!approved) return;
    if (order.activeAssignment) {
      const confirmed = await this.dialog.confirm({
        title: 'Reasignar libro',
        message: `${order.user.displayName || order.user.email || 'Este pedido'} ya tiene un libro asignado. Se reemplazará la asignación actual. ¿Continuar?`,
        confirmLabel: 'Reasignar',
        cancelLabel: 'Cancelar',
        danger: true,
      });
      if (!confirmed) return;
    }
    await this.run(async () => {
      const payload = {
        bookEditionId: edition.id,
        classificationVersionId: approved.id,
        reason: 'Asignación directa desde catálogo',
      };
      if (order.activeAssignment) {
        await this.api.adminReplace(order.activeAssignment.id, payload);
        this.toast.success(`Reasignado: ${book.canonicalTitle}`);
      } else {
        await this.api.adminAssign(fulfillmentId, payload);
        this.toast.success(`Asignado: ${book.canonicalTitle}`);
      }
      this.selectedOrder.set(null);
      this.selectedBook.set(null);
      this.assignEditionId.set('');
      await this.loadAssignments();
    });
  }

  async startReplace(assignmentId: string): Promise<void> {
    const assignment = this.assignments().find((item) => item.id === assignmentId);
    if (!assignment) return;
    if (this.replaceTarget() === assignmentId) {
      this.replaceTarget.set(null);
      return;
    }
    await this.score(assignment.fulfillment.id);
    this.replaceTarget.set(assignmentId);
  }

  replacementCandidates(assignment: AdminAssignment): AdminCandidate[] {
    const candidates = this.scoredFor(assignment.fulfillment.id) ?? [];
    return candidates.filter((candidate) => candidate.bookEditionId !== assignment.edition.id);
  }

  async replaceWithCandidate(assignmentId: string, candidate: AdminCandidate): Promise<void> {
    const assignment = this.assignments().find((item) => item.id === assignmentId);
    if (!assignment) return;
    const confirmed = await this.dialog.confirm({
      title: 'Reasignar libro',
      message: `¿Estás seguro de que quieres reemplazar «${assignment.edition.title}» por «${candidate.title}»?`,
      confirmLabel: 'Reasignar',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!confirmed) return;
    const reason = await this.dialog.prompt({
      title: 'Reasignar libro',
      message: `Se reemplazará con «${candidate.title}».`,
      inputLabel: 'Razón del reemplazo (opcional)',
      placeholder: 'Opcional',
      confirmLabel: 'Reasignar',
    });
    if (reason === null) return;
    await this.run(async () => {
      await this.api.adminReplace(assignmentId, {
        bookEditionId: candidate.bookEditionId,
        classificationVersionId: candidate.classificationVersionId,
        candidateId: candidate.candidateId,
        reason: reason || undefined,
      });
      this.toast.success(`Reasignado: ${candidate.title}`);
      this.replaceTarget.set(null);
      await this.loadAssignments();
    });
  }

  breakdown(candidate: AdminCandidate): string {
    return JSON.stringify({
      finalScore: candidate.finalScore,
      numeric: candidate.numericFitScore,
      tag: candidate.tagFitScore,
      context: candidate.contextFitScore,
      discovery: candidate.discoveryFitScore,
      risk: candidate.riskPenalty,
      coverage: candidate.recommendationEvidenceCoverage,
      reasons: candidate.explanation.reasons,
      tagMatches: candidate.explanation.tagMatches,
      riskBreakdown: candidate.explanation.risk,
    }, null, 2);
  }

  authorNames(book: AdminBook): string {
    return book.authors.map((a) => a.author.canonicalName).join(', ');
  }

  contributorNames(edition: AdminEdition): string {
    return edition.contributors.map((c) => c.author.canonicalName).join(', ');
  }

  onNewBookQuery(): void {
    if (this.newBookTimer) clearTimeout(this.newBookTimer);
    if (!this.newBookQuery.trim()) {
      this.newBookSeq++;
      this.newBookResults.set([]);
      this.newBookSearch.set({ loading: false, error: null });
      return;
    }
    this.newBookTimer = setTimeout(() => this.runNewBookSearch(this.newBookQuery), 300);
  }

  private runNewBookSearch(query: string): void {
    const seq = ++this.newBookSeq;
    this.newBookSearch.set({ loading: true, error: null });
    this.api.searchBooks(query).then((results) => {
      if (seq !== this.newBookSeq) return;
      this.newBookResults.set(results);
      this.newBookSearch.set({ loading: false, error: null });
    }).catch(() => {
      if (seq !== this.newBookSeq) return;
      this.newBookResults.set([]);
      this.newBookSearch.set({ loading: false, error: 'No pudimos buscar libros. Revisa tu conexión.' });
    });
  }

  retryNewBookSearch(): void {
    if (!this.newBookQuery.trim()) return;
    this.runNewBookSearch(this.newBookQuery);
  }

  async createBookFromResult(book: BookResult): Promise<void> {
    this.creatingBook.set(true);
    try {
      await this.run(async () => {
        const authors = book.authors.map((name, index) => ({ name, role: 'author', position: index }));
        this.newBookQuery = '';
        this.newBookSeq++;
        this.newBookResults.set([]);
        this.newBookSearch.set({ loading: false, error: null });
        const created = await this.api.createAdminBook({ canonicalTitle: book.title, originalLanguage: book.originalLanguage, openLibraryEditionId: book.openLibraryEditionId ?? undefined, authors });
        this.toast.success(created.editions.length > 0 ? `Libro y edición creados: ${book.title}` : `Libro creado: ${book.title}`);
        await this.loadBooks();
      });
    } finally {
      this.creatingBook.set(false);
    }
  }

  async deleteBook(bookId: string, title: string): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'Eliminar libro',
      message: `¿Eliminar «${title}» del catálogo? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!confirmed) return;
    await this.run(async () => {
      await this.api.deleteAdminBook(bookId);
      this.toast.success(`Libro eliminado: ${title}`);
      await this.loadBooks();
    });
  }

  async createManualClassification(editionId: string): Promise<void> {
    await this.run(async () => {
      const created = await this.api.createAdminClassificationDraft(editionId, {
        contentTypeKey: this.newClassification.contentType,
        contentTypeSchemaVersion: CONTENT_TYPE_SCHEMA_VERSION,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        tagTaxonomyVersion: TAG_TAXONOMY_VERSION,
      });
      this.toast.success('Borrador listo. Completa las features y tags antes de aprobar.');
      void this.router.navigate(['/app/admin/clasificacion', created.id]);
    });
  }

  async createAiClassification(editionId: string): Promise<void> {
    await this.run(async () => {
      const created = await this.api.createAdminClassificationDraft(editionId, {
        contentTypeKey: this.newClassification.contentType,
        contentTypeSchemaVersion: CONTENT_TYPE_SCHEMA_VERSION,
        featureSchemaVersion: FEATURE_SCHEMA_VERSION,
        tagTaxonomyVersion: TAG_TAXONOMY_VERSION,
      });
      this.toast.success('Borrador listo. Sube el PDF en el editor para clasificar con IA.');
      void this.router.navigate(['/app/admin/clasificacion', created.id], { queryParams: { ai: 1 } });
    });
  }

  openEditor(classificationId: string): void {
      void this.router.navigate(['/app/admin/clasificacion', classificationId]);
  }

  async correct(classificationId: string): Promise<void> {
    await this.run(async () => {
      const corrected = await this.api.correctAdminClassification(classificationId);
      this.toast.success(`Revisión ${corrected.revision} creada con los valores precargados.`);
      void this.router.navigate(['/app/admin/clasificacion', corrected.id]);
    });
  }

  async deleteClassification(classificationId: string): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: 'Eliminar revisión',
      message: '¿Eliminar esta revisión en borrador? Solo se descarta el borrador; las revisiones aprobadas no se afectan.',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!confirmed) return;
    await this.run(async () => {
      await this.api.deleteAdminClassification(classificationId);
      this.toast.success('Borrador eliminado.');
      await this.loadBooks();
    });
  }

  private searchText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  async action(action: 'pack' | 'ship' | 'in-delivery' | 'delivered' | 'close-without-feedback' | 'reissue-invitation' | 'unpack' | 'unship' | 'undo-in-delivery' | 'undo-delivered', assignmentId: string): Promise<void> {
    const confirm = this.confirmations[action];
    if (confirm) {
      const confirmed = await this.dialog.confirm({ title: confirm.title, message: confirm.message, confirmLabel: confirm.confirmLabel, cancelLabel: 'Cancelar', danger: confirm.danger });
      if (!confirmed) return;
    }
    await this.run(async () => {
      const result = await this.api.adminAction(action, assignmentId);
      if (result.url) {
        this.invitationUrl.set(result.url);
        this.invitationFor.set(assignmentId);
      }
      await this.loadAssignments();
    });
  }

  async reopenLearning(assignmentId: string): Promise<void> {
    const first = await this.dialog.confirm({
      title: 'Reabrir aprendizaje',
      message: 'Se reabrirá el ciclo de aprendizaje: se revoca la invitación actual y se genera una nueva. ¿Continuar?',
      confirmLabel: 'Continuar',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!first) return;
    const second = await this.dialog.confirm({
      title: 'Confirmar reapertura',
      message: 'Esta acción revocará la invitación vigente y emitirá una nueva. ¿Confirmar la reapertura del ciclo?',
      confirmLabel: 'Reabrir ciclo',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!second) return;
    await this.run(async () => {
      const result = await this.api.adminReopenLearning(assignmentId, undefined);
      if (result.url) {
        this.invitationUrl.set(result.url);
        this.invitationFor.set(assignmentId);
      }
      this.toast.success('Ciclo reabierto. Nueva invitación generada.');
      await this.loadAssignments();
    });
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    this.loading.set(true);
    try {
      await operation();
    } catch (error) {
      const body = (error as { error?: { message?: string } }).error;
      const message = typeof body?.message === 'string' ? body.message : error instanceof Error ? error.message : 'La operación no pudo completarse.';
      this.toast.error(message);
    } finally {
      this.loading.set(false);
    }
  }
}
