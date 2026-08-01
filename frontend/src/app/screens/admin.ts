import { Component, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAssignment, AdminBook, AdminCandidate, AdminEdition, AdminFulfillment, AdminOrder, AdminScoreResult, ApiService, BookResult } from '../api.service';
import { DialogService } from '../dialog.service';
import { ToastService } from '../toast.service';
import { FULFILLMENT_LABELS } from '../components/order-timeline';
import { TAG_LABELS, TAG_TYPE_LABELS } from '../labels';

const CONTENT_TYPE_SCHEMA_VERSION = 'content-types/1.0';
const FEATURE_SCHEMA_VERSION = 'book-features/1.0';
const TAG_TAXONOMY_VERSION = 'tag-tax/1.0.1';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, DatePipe, CurrencyPipe],
  template: `
    <div class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p class="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Administración</p>
      <h1 class="mb-6 font-display text-4xl font-bold tracking-[-0.045em] text-ink sm:text-5xl">Catálogo y envíos</h1>

      <div class="mb-6 flex gap-2">
        <button type="button" class="rounded-sm border px-4 py-2 text-sm font-bold transition" [class.bg-ink]="tab()==='catalog'" [class.text-white]="tab()==='catalog'" [class.border-ink]="tab()==='catalog'" [class.border-[#7d9ab0]]="tab()!=='catalog'" (click)="tab.set('catalog')">Catálogo</button>
        <button type="button" class="rounded-sm border px-4 py-2 text-sm font-bold transition" [class.bg-ink]="tab()==='curation'" [class.text-white]="tab()==='curation'" [class.border-ink]="tab()==='curation'" [class.border-[#7d9ab0]]="tab()!=='curation'" (click)="tab.set('curation'); loadAssignments()">Curación</button>
        <button type="button" class="rounded-sm border px-4 py-2 text-sm font-bold transition" [class.bg-ink]="tab()==='orders'" [class.text-white]="tab()==='orders'" [class.border-ink]="tab()==='orders'" [class.border-[#7d9ab0]]="tab()!=='orders'" (click)="tab.set('orders'); loadOrders()">Pedidos</button>
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

                    @for (classification of edition.classifications; track classification.id) {
                      <div class="mt-2 border-t border-[#e3ebf0] pt-2 text-xs">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="font-mono text-[#567088]">rev {{ classification.revision }}</span>
                          <span class="font-mono text-[#567088]">{{ classification.status }}</span>
                          <span class="font-mono text-[#567088]">{{ classification.contentTypeKey }}</span>
                          @if (classification.status === 'draft') {
                            <button type="button" class="rounded-sm border border-[#9eb2c1] px-2 py-1 hover:bg-[#e6eef3]" (click)="openEditor(classification.id)">Editar</button>
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

          @if (fulfillments().length > 0) {
            <div class="rounded-sm border border-[#cad7df] bg-white p-4">
              <h2 class="mb-3 font-semibold text-ink">Fulfillments pendientes</h2>
              @for (fulfillment of fulfillments(); track fulfillment.id) {
                <div class="border-t border-[#e3ebf0] py-3">
                  <div class="flex flex-wrap items-center gap-3">
                    <strong class="text-ink">{{ fulfillment.order.packageName }}</strong>
                    <span class="font-mono text-xs text-[#567088]">estado: {{ fulfillment.status }}</span>
                    <span class="font-mono text-xs text-[#567088]">pedido: {{ fulfillment.order.id.slice(0, 8) }}</span>
                    <button type="button" class="rounded-sm bg-ink px-3 py-1 text-sm font-bold text-white hover:bg-ink-soft disabled:opacity-60" (click)="score(fulfillment.id)" [disabled]="loading()">Puntuar</button>
                  </div>
                  @if (scoredFor(fulfillment.id); as candidates) {
                    @for (candidate of candidates; track candidate.candidateId) {
                      <div class="mt-2 rounded-sm border border-[#d6e1e8] p-3">
                        <div class="flex flex-wrap items-center gap-3">
                          <span class="font-mono text-xs text-[#567088]">#{{ candidate.rankPosition }}</span>
                          <strong class="text-ink">{{ candidate.title }}</strong>
                          <span class="text-xs text-[#536875]">{{ candidate.editionTitle }}</span>
                          <span class="font-mono text-xs text-[#567088]">score {{ (candidate.finalScore ?? 0).toFixed(4) }}</span>
                          @if (candidate.recommendationEvidenceCoverage !== null && candidate.recommendationEvidenceCoverage < 0.45) {
                            <span class="rounded-full bg-[#fbe9e6] px-2 py-0.5 text-xs font-semibold text-[#7a2c1f]">baja cobertura</span>
                          }
                          <button type="button" class="rounded-sm bg-coral px-3 py-1 text-sm font-bold text-white hover:bg-coral-deep disabled:opacity-60" (click)="assignCandidate(fulfillment.id, candidate)" [disabled]="loading()">Asignar</button>
                        </div>
                        @if (candidate.explanation.reasons.length > 0 || candidate.explanation.tagMatches.length > 0) {
                          <details class="mt-1">
                            <summary class="cursor-pointer text-xs text-[#567088]">Desglose y explicación</summary>
                            <pre class="mt-1 max-h-64 overflow-auto rounded-sm bg-[#142c3e] p-2 font-mono text-[11px] text-[#e4eff5]">{{ breakdown(candidate) }}</pre>
                          </details>
                        }
                      </div>
                    }
                  }
                </div>
              }
            </div>
          }

          @for (assignment of assignments(); track assignment.id) {
            <div class="rounded-sm border border-[#cad7df] bg-white p-4">
              <div class="flex flex-wrap items-center gap-3">
                <strong class="text-ink">{{ assignment.edition.title }}</strong>
                <span class="font-mono text-xs text-[#567088]">fulfillment: {{ assignment.fulfillment.status }}</span>
                <span class="font-mono text-xs text-[#567088]">ciclo: {{ assignment.feedbackCycleStatus }}</span>
                <span class="font-mono text-xs text-[#567088]">rev {{ assignment.classification.revision }}</span>
              </div>
              @if (invitationUrl() && invitationFor() === assignment.id) {
                <p class="mt-2 break-all rounded-sm bg-[#e2f0e9] px-3 py-2 text-sm text-[#16442f]">Invitación: <a class="underline" [href]="invitationUrl()" target="_blank">{{ invitationUrl() }}</a></p>
              }
              <div class="mt-2 flex flex-wrap gap-2">
                @if (assignment.fulfillment.status === 'assigned') {
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="startReplace(assignment.id)">Reemplazar</button>
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('pack', assignment.id)">Empaquetar</button>
                }
                @if (assignment.fulfillment.status === 'packed') {
                  <button type="button" class="rounded-sm bg-coral px-3 py-1 text-sm font-bold text-white" (click)="action('ship', assignment.id)">Enviar</button>
                }
                @if (assignment.fulfillment.status === 'shipped') {
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('delivered', assignment.id)">Marcar entregado</button>
                }
                @if (['invited', 'provisional_received'].includes(assignment.feedbackCycleStatus)) {
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('reissue-invitation', assignment.id)">Reemitir invitación</button>
                }
                @if (assignment.feedbackCycleStatus !== 'closed_without_feedback') {
                  <button type="button" class="rounded-sm border border-[#7d9ab0] px-3 py-1 text-sm hover:bg-[#e6eef3]" (click)="action('close-without-feedback', assignment.id)">Cerrar sin feedback</button>
                }
              </div>
              @if (replaceTarget() === assignment.id && scoredFor(assignment.fulfillment.id); as candidates) {
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
              }
              @if (assignment.feedbacks.length > 0) {
                <ul class="mt-2 list-inside list-disc text-xs text-[#536875]">
                  @for (feedback of assignment.feedbacks; track feedback.id) {
                    <li>{{ feedback.isFinal ? 'Final' : 'Provisional' }} · {{ feedback.learningStatus }} · {{ feedback.submittedAt | date:'short' }}</li>
                  }
                </ul>
              }
            </div>
          }
          @if (assignments().length === 0 && !loading()) {
            <p class="text-sm text-[#7d9ab0]">No hay asignaciones.</p>
          }
        </section>
      }

      @if (tab() === 'orders') {
        <section class="space-y-4">
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
  private readonly dialog = inject(DialogService);

  readonly tab = signal<'catalog' | 'curation' | 'orders'>('catalog');
  readonly books = signal<AdminBook[]>([]);
  readonly assignments = signal<AdminAssignment[]>([]);
  readonly fulfillments = signal<AdminFulfillment[]>([]);
  readonly orders = signal<AdminOrder[]>([]);
  readonly scored = signal<Record<string, AdminCandidate[]>>({});
  readonly replaceTarget = signal<string | null>(null);
  readonly loading = signal(false);
  readonly invitationUrl = signal<string | null>(null);
  readonly invitationFor = signal<string | null>(null);
  readonly orderStatusOptions = [
    { value: 'curation_pending', label: 'Orden recibida' },
    { value: 'assigned', label: 'Selección de libro' },
    { value: 'packed', label: 'Preparación de orden' },
    { value: 'shipped', label: 'Enviado' },
    { value: 'delivered', label: 'En proceso de entrega' },
    { value: 'canceled', label: 'Cancelado' },
  ];

  bookQuery = '';
  orderQuery = '';
  orderStatus = '';
  newBookQuery = '';
  newClassification = { contentType: 'fiction' };
  readonly tagLabels = TAG_LABELS;
  readonly tagTypeLabels = TAG_TYPE_LABELS;
  readonly newBookResults = signal<BookResult[]>([]);
  readonly newBookSearch = signal<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  readonly creatingBook = signal(false);
  private newBookTimer: ReturnType<typeof setTimeout> | null = null;
  private newBookSeq = 0;

  constructor() {
    void this.loadBooks();
  }

  async loadOrders(): Promise<void> {
    await this.run(async () => {
      this.orders.set(await this.api.listAdminOrders(this.orderQuery, this.orderStatus));
    });
  }

  async fulfillAction(action: 'pack' | 'ship' | 'delivered', order: AdminOrder): Promise<void> {
    if (!order.activeAssignment) return;
    const assignmentId = order.activeAssignment.id;
    await this.run(async () => {
      await this.api.adminAction(action, assignmentId);
      this.toast.success(action === 'pack' ? 'Pedido empacado.' : action === 'ship' ? 'Pedido enviado.' : 'Pedido marcado como entregado.');
      await this.loadOrders();
    });
  }

  goToCuration(): void {
    this.tab.set('curation');
    void this.loadAssignments();
  }

  openReader(userId: string): void {
    void this.router.navigate(['/lectores'], { queryParams: { userId } });
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
      this.fulfillments.set(fulfillments.filter((fulfillment) => fulfillment.status === 'curation_pending' || fulfillment.status === 'assigned'));
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
    const reason = window.prompt('Razón de la selección (opcional):') ?? undefined;
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

  async startReplace(assignmentId: string): Promise<void> {
    const assignment = this.assignments().find((item) => item.id === assignmentId);
    if (!assignment) return;
    if (this.replaceTarget() === assignmentId) {
      this.replaceTarget.set(null);
      return;
    }
    this.replaceTarget.set(assignmentId);
    await this.score(assignment.fulfillment.id);
  }

  async replaceWithCandidate(assignmentId: string, candidate: AdminCandidate): Promise<void> {
    const reason = window.prompt('Razón del reemplazo (opcional):') ?? undefined;
    await this.run(async () => {
      await this.api.adminReplace(assignmentId, {
        bookEditionId: candidate.bookEditionId,
        classificationVersionId: candidate.classificationVersionId,
        candidateId: candidate.candidateId,
        reason: reason || undefined,
      });
      this.toast.success(`Reemplazado con: ${candidate.title}`);
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
      void this.router.navigate(['/admin/clasificacion', created.id]);
    });
  }

  openEditor(classificationId: string): void {
    void this.router.navigate(['/admin/clasificacion', classificationId]);
  }

  async correct(classificationId: string): Promise<void> {
    await this.run(async () => {
      const corrected = await this.api.correctAdminClassification(classificationId);
      this.toast.success(`Revisión ${corrected.revision} creada con los valores precargados.`);
      void this.router.navigate(['/admin/clasificacion', corrected.id]);
    });
  }

  private searchText(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  async action(action: 'pack' | 'ship' | 'delivered' | 'close-without-feedback' | 'reissue-invitation', assignmentId: string): Promise<void> {
    await this.run(async () => {
      const result = await this.api.adminAction(action, assignmentId);
      if (result.url) {
        this.invitationUrl.set(result.url);
        this.invitationFor.set(assignmentId);
      }
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
