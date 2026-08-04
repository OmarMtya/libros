import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService, Profile as ReaderProfile, ProfileFeedbackBook } from '../api.service';
import { AuthService } from '../auth.service';
import { TAG_LABELS } from '../labels';
import { ToastService } from '../toast.service';
import { BookCarousel, BookReview } from '../components/book-carousel';

type ProfileBook = { title?: string; work_id?: string; openLibraryId?: string; authors?: string[]; coverUrl?: string | null; review?: BookReview | null };

@Component({
  selector: 'app-profile',
  imports: [RouterLink, BookCarousel],
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
            <div class="mb-6">
              <div>
                <h2 class="font-display text-2xl font-bold tracking-[-0.03em] text-ink">{{ displayName() }}</h2>
                <p class="mt-1 text-sm text-[#536875]">Con esto afinamos cada sorpresa.</p>
              </div>
            </div>

            <h3 class="mb-2 text-sm font-bold uppercase tracking-wider text-ink">Categorías</h3>
            <div class="space-y-3 text-sm">
              <p><strong class="text-ink">Me gustan:</strong>
                @for (tag of categoryPreferences('positive'); track tag.tagKey) {
                  <span class="ml-2 my-1 inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-ink">{{ profileTagLabel(tag.tagKey) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin categorías declaradas.</span> }
              </p>
              <p><strong class="text-ink">Me dan curiosidad:</strong>
                @for (tag of categoryPreferences('curious'); track tag.tagKey) {
                  <span class="ml-2 my-1 inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-ink">{{ profileTagLabel(tag.tagKey) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin categorías declaradas.</span> }
              </p>
              <p><strong class="text-ink">No me interesan por ahora:</strong>
                @for (tag of categoryPreferences('negative'); track tag.tagKey) {
                  <span class="ml-2 my-1 inline-flex rounded-full bg-[#fbe9e6] px-3 py-1 text-[#7a2c1f]">{{ profileTagLabel(tag.tagKey) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin categorías declaradas.</span> }
              </p>
            </div>

            <h3 class="mb-2 mt-8 text-sm font-bold uppercase tracking-wider text-ink">Libros</h3>
            <div class="space-y-8">
              <div>
                <app-book-carousel title="Disfrutados" [books]="enjoyedBooks()" />
              </div>
              <div>
                <app-book-carousel title="No disfrutados o abandonados" [books]="notEnjoyedBooks()" />
              </div>
            </div>

            <h3 class="mb-2 mt-8 text-sm font-bold uppercase tracking-wider text-ink">Preferencias</h3>
            @if (current.operationalConstraints; as constraints) {
              <div class="flex flex-wrap gap-2">
                <span class="inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-sm text-ink">
                  De {{ constraints.preferredPagesMin }} a {{ constraints.preferredPagesMax }} páginas
                </span>
                <span class="inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-sm text-ink">
                  Sagas: {{ seriesLabel(constraints.seriesPreference) }}
                </span>
                @for (language of constraints.acceptedLanguagesJson; track language) {
                  <span class="inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-sm text-ink">{{ languageLabel(language) }}</span>
                }
                @for (format of constraints.acceptedFormatsJson; track format) {
                  <span class="inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-sm text-ink">{{ formatLabel(format) }}</span>
                }
              </div>
            } @else {
              <p class="text-sm text-[#7d9ab0]">Sin restricciones completas.</p>
            }
          </section>
        </div>
      } @else {
        <section class="rounded-sm border border-[#cad7df] bg-white p-10 text-center">
          <h2 class="font-display text-2xl font-bold tracking-[-0.03em] text-ink">Aún no tienes perfil lector</h2>
          <p class="mt-2 mb-5 text-sm text-[#536875]">Responde el cuestionario para que armemos tus recomendaciones.</p>
          <a routerLink="/app/cuestionario" class="inline-block rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep">
            Hacer cuestionario
          </a>
        </section>
      }
    </div>
  `,
})
export class ProfileScreen {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly profile = signal<ReaderProfile | null>(null);
  readonly loading = signal(false);

  readonly displayName = computed(() => {
    const metadata = this.auth.session()?.user.user_metadata as Record<string, unknown> | undefined;
    const name = typeof metadata?.['full_name'] === 'string' ? metadata['full_name'] : typeof metadata?.['name'] === 'string' ? metadata['name'] : null;
    return name?.trim() || 'Tus preferencias';
  });

  constructor() {
    void this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    await this.run(async () => {
      const profile = await this.api.getProfile().catch((error) => {
        if (error && error.status === 404) return null;
        throw error;
      });
      if (!profile || !(profile.questionnaireSessions ?? []).some((session) => session.status === 'completed')) {
        await this.router.navigate(['/app/cuestionario']);
        return;
      }
      this.profile.set(profile);
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

  readonly enjoyedBooks = computed<ProfileBook[]>(() => {
    const feedback = (this.profile()?.feedbackBooks ?? [])
      .filter((book) => book.selectionFitRating !== null
        ? book.selectionFitRating >= 4
        : book.readingStatus === 'completed')
      .map((book) => this.bookWithReview(book));
    return this.mergeBooks([...this.profileBooks('Q01_LOVED_BOOKS'), ...feedback]);
  });

  readonly notEnjoyedBooks = computed<ProfileBook[]>(() => {
    const feedback = (this.profile()?.feedbackBooks ?? [])
      .filter((book) => book.selectionFitRating !== null
        ? book.selectionFitRating <= 2
        : book.readingStatus === 'abandoned' || book.readingStatus === 'not_started')
      .map((book) => this.bookWithReview(book));
    return this.mergeBooks([...this.profileBooks('Q02_DISLIKED_BOOK'), ...feedback]);
  });

  private bookWithReview(book: ProfileFeedbackBook): ProfileBook {
    return {
      title: book.title,
      authors: book.authors,
      coverUrl: book.coverUrl,
      review: {
        readingStatus: book.readingStatus,
        selectionFitRating: book.selectionFitRating,
        started: book.started,
        completionPercentage: book.completionPercentage,
        notStartedReason: book.notStartedReason,
        outcomeAttribution: book.outcomeAttribution,
        positiveAspects: book.positiveAspects,
        negativeAspects: book.negativeAspects,
        freeText: book.freeText,
      },
    };
  }

  private mergeBooks(books: ProfileBook[]): ProfileBook[] {
    const seen = new Map<string, ProfileBook>();
    for (const book of books) {
      const key = (book.title ?? book.work_id ?? book.openLibraryId ?? '').trim().toLowerCase();
      if (!key) continue;
      const existing = seen.get(key);
      if (existing) {
        if (!existing.review && book.review) existing.review = book.review;
        continue;
      }
      seen.set(key, book);
    }
    return [...seen.values()];
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

  languageLabel(code: string): string {
    const labels: Record<string, string> = {
      es: 'Español', en: 'Inglés', pt: 'Portugués', fr: 'Francés', de: 'Alemán',
      it: 'Italiano', nl: 'Neerlandés', ru: 'Ruso',
    };
    return labels[code] ?? code;
  }

  formatLabel(format: string): string {
    const labels: Record<string, string> = { physical: 'Físico', ebook: 'Ebook', audiobook: 'Audiolibro' };
    return labels[format] ?? format;
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
