import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, orderFeedbackDone, orderIsActive, Profile as ReaderProfile, UserOrder } from '../api.service';
import { DialogService } from '../dialog.service';
import { TAG_LABELS } from '../labels';
import { ToastService } from '../toast.service';
import { FULFILLMENT_LABELS } from '../components/order-timeline';

type ProfileBook = { title?: string; work_id?: string; openLibraryId?: string; authors?: string[] };

@Component({
  selector: 'app-profile',
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p class="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Tu ficha de lectura</p>
      <h1 class="mb-8 font-display text-4xl font-bold tracking-[-0.045em] text-ink sm:text-5xl">Mi perfil lector</h1>

      @if (loading()) {
        <section class="rounded-sm border border-[#cad7df] bg-white p-10 text-center">
          <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Cargando tu perfil…</p>
        </section>
      } @else if (profile(); as current) {
        <div class="space-y-6">
          <section class="rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
            <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 class="font-display text-2xl font-bold tracking-[-0.03em] text-ink">Tus preferencias</h2>
                <p class="mt-1 text-sm text-[#536875]">Con esto afinamos cada sorpresa.</p>
              </div>
              <span class="rounded-full px-3 py-1 font-mono text-xs"
                [class.bg-[#e2f0e9]]="current.readyToRecommend"
                [class.text-[#16442f]]="current.readyToRecommend"
                [class.bg-[#fbe9e6]]="!current.readyToRecommend"
                [class.text-[#7a2c1f]]="!current.readyToRecommend">
                {{ current.readyToRecommend ? 'Listo para recomendar' : 'Perfil en construcción' }}
              </span>
            </div>

            <h3 class="mb-2 text-sm font-bold uppercase tracking-wider text-ink">Categorías</h3>
            <div class="space-y-3 text-sm">
              <p><strong class="text-ink">Me gustan:</strong>
                @for (tag of categoryPreferences('positive'); track tag.tagKey) {
                  <span class="ml-2 inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-ink">{{ profileTagLabel(tag.tagKey) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin categorías declaradas.</span> }
              </p>
              <p><strong class="text-ink">Me dan curiosidad:</strong>
                @for (tag of categoryPreferences('curious'); track tag.tagKey) {
                  <span class="ml-2 inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-ink">{{ profileTagLabel(tag.tagKey) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin categorías declaradas.</span> }
              </p>
              <p><strong class="text-ink">No me interesan por ahora:</strong>
                @for (tag of categoryPreferences('negative'); track tag.tagKey) {
                  <span class="ml-2 inline-flex rounded-full bg-[#fbe9e6] px-3 py-1 text-[#7a2c1f]">{{ profileTagLabel(tag.tagKey) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin categorías declaradas.</span> }
              </p>
            </div>

            <h3 class="mb-2 mt-8 text-sm font-bold uppercase tracking-wider text-ink">Libros</h3>
            <div class="space-y-3 text-sm">
              <p><strong class="text-ink">Disfrutados:</strong>
                @for (book of profileBooks('Q01_LOVED_BOOKS'); track book.title ?? book.work_id ?? book.openLibraryId) {
                  <span class="ml-2 inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-ink">{{ bookLabel(book) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin libros declarados.</span> }
              </p>
              <p><strong class="text-ink">No disfrutados o abandonados:</strong>
                @for (book of profileBooks('Q02_DISLIKED_BOOK'); track book.title ?? book.work_id ?? book.openLibraryId) {
                  <span class="ml-2 inline-flex rounded-full bg-[#fbe9e6] px-3 py-1 text-[#7a2c1f]">{{ bookLabel(book) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin libros declarados.</span> }
              </p>
            </div>

            <h3 class="mb-2 mt-8 text-sm font-bold uppercase tracking-wider text-ink">Restricciones</h3>
            @if (current.operationalConstraints; as constraints) {
              <p class="text-sm text-[#536875]">
                Páginas: {{ constraints.preferredPagesMin }} a {{ constraints.preferredPagesMax }}.
                Sagas: {{ seriesLabel(constraints.seriesPreference) }}.
                Idiomas: {{ constraints.acceptedLanguagesJson.join(', ') }}.
                Formatos: {{ constraints.acceptedFormatsJson.join(', ') }}.
              </p>
            } @else {
              <p class="text-sm text-[#7d9ab0]">Sin restricciones completas.</p>
            }
          </section>

          @if (order(); as order) {
            <section class="rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
              <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 class="font-display text-2xl font-bold tracking-[-0.03em] text-ink">Tu pedido</h2>
                  <p class="mt-1 text-sm text-[#536875]">{{ order.packageName }} · {{ statusLabel(order) }}</p>
                </div>
                <a
                  routerLink="/mi-paquete"
                  class="rounded-sm border border-[#7d9ab0] px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#e6eef3]">
                  Seguir mi pedido
                </a>
              </div>
              @if (feedbackDone()) {
                <p class="rounded-sm bg-[#e2f0e9] px-3 py-2 text-sm text-[#16442f]">
                  ¡Gracias por tu feedback! Ya puedes elegir tu siguiente sorpresa.
                </p>
              } @else {
                <p class="text-sm text-[#536875]">
                  Tu envío está en proceso. Envíos de 5 a 10 días hábiles; te comunicaremos cada paso.
                </p>
              }
            </section>
          }

          <section class="rounded-sm border border-[#cad7df] bg-[#fffdf7] p-6 sm:p-8">
            <h2 class="font-display text-2xl font-bold tracking-[-0.03em] text-ink">¿Cambiaste de opinión?</h2>
            <p class="mt-1 mb-4 max-w-lg text-sm text-[#536875]">
              Puedes responder el cuestionario de nuevo. Tus respuestas anteriores se descartan y tu perfil se vuelve a calcular.
            </p>
            <button
              class="rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep disabled:cursor-wait disabled:opacity-60"
              type="button"
              (click)="redoQuestionnaire()"
              [disabled]="loading()">
              Hacer cuestionario de nuevo
            </button>
          </section>
        </div>
      }
    </div>
  `,
})
export class ProfileScreen {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly toast = inject(ToastService);

  readonly profile = signal<ReaderProfile | null>(null);
  readonly loading = signal(false);
  readonly orders = signal<UserOrder[]>([]);
  readonly order = computed(() => this.orders().find(orderIsActive) ?? null);
  readonly feedbackDone = computed(() => (this.order() ? orderFeedbackDone(this.order()!) : false));

  constructor() {
    void this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    await this.run(async () => {
      const [profile, orders] = await Promise.all([this.api.getProfile(), this.api.listOrders()]);
      this.profile.set(profile);
      this.orders.set(orders);
    });
  }

  statusLabel(order: UserOrder): string {
    const status = order.fulfillment?.status ?? '';
    return FULFILLMENT_LABELS[status] ?? 'Pedido';
  }

  async redoQuestionnaire(): Promise<void> {
    const confirmed = await this.dialog.confirm({
      title: '¿Cambiaste de opinión?',
      message: '¿Seguro que quieres responder el cuestionario de nuevo? Tus respuestas actuales se descartarán.',
      confirmLabel: 'Hacer cuestionario de nuevo',
      cancelLabel: 'Cancelar',
      danger: true,
    });
    if (!confirmed) return;
    await this.run(async () => {
      await this.api.resetQuestionnaire();
      this.profile.set(null);
      await this.router.navigate(['/cuestionario']);
    });
  }

  categoryPreferences(kind: 'positive' | 'curious' | 'negative') {
    return (this.profile()?.tagPreferences ?? []).filter((preference) => kind === 'positive'
      ? Number(preference.affinity) >= 0.8
      : kind === 'curious'
        ? Number(preference.affinity) > 0
        : Number(preference.affinity) < 0) ?? [];
  }

  profileBooks(questionKey: 'Q01_LOVED_BOOKS' | 'Q02_DISLIKED_BOOK'): ProfileBook[] {
    return (this.profile()?.questionnaireSessions ?? [])
      .flatMap((session) => session.answers)
      .filter((answer) => answer.questionKey === questionKey)
      .flatMap((answer) => this.booksFromResponse(answer.rawResponse)) ?? [];
  }

  bookLabel(book: ProfileBook): string {
    const title = book.title ?? book.work_id ?? book.openLibraryId ?? 'Libro sin título';
    return book.authors?.length ? `${title} - ${book.authors.join(', ')}` : title;
  }

  profileTagLabel(tagKey: string): string {
    return TAG_LABELS[tagKey] ?? tagKey;
  }

  seriesLabel(value: string | null): string {
    switch (value) {
      case 'standalone_only': return 'solo autoconclusivos';
      case 'standalone_preferred': return 'prefiere autoconclusivos';
      case 'no_preference': return 'sin preferencia';
      default: return value ?? 'sin preferencia';
    }
  }

  private booksFromResponse(value: unknown): ProfileBook[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const books = (value as { books?: unknown }).books;
    return Array.isArray(books) ? books.filter((book): book is ProfileBook => Boolean(book) && typeof book === 'object' && !Array.isArray(book)) : [];
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    this.loading.set(true);
    try {
      await operation();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'La operación no pudo completarse.');
    } finally {
      this.loading.set(false);
    }
  }
}
