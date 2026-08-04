import { Component, ElementRef, Input, OnDestroy, signal, viewChild } from '@angular/core';
import { FEEDBACK_NEGATIVE_ASPECTS, FEEDBACK_POSITIVE_ASPECTS } from '../labels';

export type BookReview = {
  readingStatus: string;
  selectionFitRating: number | null;
  started: boolean;
  completionPercentage: number;
  notStartedReason: string | null;
  outcomeAttribution: string | null;
  positiveAspects: string[];
  negativeAspects: string[];
  freeText: string | null;
};

export type BookCarouselItem = {
  title?: string;
  work_id?: string;
  openLibraryId?: string;
  authors?: string[];
  coverUrl?: string | null;
  review?: BookReview | null;
};

@Component({
  selector: 'app-book-carousel',
  imports: [],
  styles: `
    :host {
      display: block;
    }
    .expand-grid {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 260ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    .expand-grid.open {
      grid-template-rows: 1fr;
    }
    .expand-grid > .expand-inner {
      min-height: 0;
      overflow: hidden;
    }
    @keyframes content-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .content-swap {
      animation: content-in 240ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    @media (prefers-reduced-motion: reduce) {
      .expand-grid {
        transition: none;
      }
      .content-swap {
        animation: none;
      }
    }
  `,
  template: `
    <div class="mb-3 flex items-center justify-between gap-4">
      <h3 class="text-sm font-bold uppercase tracking-wider text-ink">{{ title }}</h3>
      @if (books.length > 0) {
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            (click)="scroll(-1)"
            [disabled]="!canPrev()"
            aria-label="Libros anteriores"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[#9eb2c1] bg-white text-ink transition hover:bg-[#e6eef3] disabled:cursor-not-allowed disabled:opacity-35">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button
            type="button"
            (click)="scroll(1)"
            [disabled]="!canNext()"
            aria-label="Libros siguientes"
            class="flex h-8 w-8 items-center justify-center rounded-full border border-[#9eb2c1] bg-white text-ink transition hover:bg-[#e6eef3] disabled:cursor-not-allowed disabled:opacity-35">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      }
    </div>
    @if (books.length === 0) {
      <p class="text-sm text-[#7d9ab0]">Sin libros declarados.</p>
    } @else {
      <div #track (scroll)="updateScrollState()" class="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 py-1">
        @for (book of books; track book.title ?? book.work_id ?? book.openLibraryId) {
          <article
            class="w-32 shrink-0 snap-start rounded-sm p-1.5 sm:w-36"
            [class.cursor-pointer]="book.review != null"
            [class.bg-[#fbe9e6]]="selectedKey() === bookKey(book)"
            [class.ring-1]="selectedKey() === bookKey(book)"
            [class.ring-[#e2b8b0]]="selectedKey() === bookKey(book)"
            [attr.role]="book.review ? 'button' : null"
            [attr.tabindex]="book.review ? 0 : null"
            [attr.aria-expanded]="selectedKey() === bookKey(book)"
            [attr.aria-label]="book.review ? (selectedKey() === bookKey(book) ? 'Ocultar reseña de ' + bookTitle(book) : 'Ver reseña de ' + bookTitle(book)) : null"
            (click)="toggleSelected(book)"
            (keydown.enter)="toggleSelected(book)"
            (keydown.space)="onKeySpace($event, book)">
            <div class="relative aspect-[2/3] overflow-hidden rounded-sm border border-[#cad7df] bg-[#f2f6f9] shadow-[0_2px_10px_rgba(19,42,58,0.10)]">
              @if (book.coverUrl) {
                <img [src]="book.coverUrl" [alt]="bookTitle(book)" loading="lazy" class="h-full w-full object-cover" />
              } @else {
                <div class="flex h-full w-full items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-6 text-[#9eb2c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                </div>
              }
            </div>
            <p class="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-ink">{{ bookTitle(book) }}</p>
            @if (authorsOf(book)) {
              <p class="mt-0.5 line-clamp-1 text-xs text-[#536875]">{{ authorsOf(book) }}</p>
            }
          </article>
        }
      </div>

      <div class="expand-grid mt-4" [class.open]="selectedKey() != null">
        <div class="expand-inner">
          @for (entry of [rendering()]; track entry ? bookKey(entry) : 'empty') {
            @if (entry; as book) {
              @if (book.review; as review) {
                <div class="content-swap rounded-sm border border-[#d6e1e8] bg-[#f7fafc] p-4">
                <div class="flex items-start gap-4">
                  <div class="h-20 w-14 shrink-0 overflow-hidden rounded-sm border border-[#cad7df] bg-[#f2f6f9]">
                    @if (book.coverUrl) {
                      <img [src]="book.coverUrl" [alt]="bookTitle(book)" loading="lazy" class="h-full w-full object-cover" />
                    } @else {
                      <div class="flex h-full w-full items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-4 text-[#9eb2c1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                      </div>
                    }
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <h4 class="font-display text-base font-bold tracking-[-0.02em] text-ink">{{ bookTitle(book) }}</h4>
                        @if (authorsOf(book)) {
                          <p class="truncate text-xs text-[#536875]">{{ authorsOf(book) }}</p>
                        }
                      </div>
                      <button
                        type="button"
                        (click)="toggleSelected(book)"
                        aria-label="Cerrar reseña"
                        class="-m-1 shrink-0 p-1 text-[#7d9ab0] transition hover:text-coral">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>

                    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span class="rounded-full bg-[#eef3f6] px-2.5 py-1 font-semibold text-ink">{{ readingStatusLabel(review.readingStatus) }}</span>
                      @if (review.selectionFitRating !== null) {
                        <span class="inline-flex items-center gap-1" [attr.aria-label]="'Le gustó ' + review.selectionFitRating + ' de 5'">
                          @for (filled of stars(review.selectionFitRating); track $index) {
                            <svg class="h-4 w-4" [class.text-coral]="filled" [class.text-[#d8e1e8]]="!filled" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd"/></svg>
                          }
                        </span>
                      }
                    </div>

                    @if (review.freeText?.trim()) {
                      <div class="mt-2 rounded-sm border-l-[3px] border-[#f0e0b0] bg-[#fff7e6] px-3 py-2">
                        <p class="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b5310]">Comentario</p>
                        <p class="mt-1 text-sm leading-relaxed text-[#4a3f14]">{{ review.freeText }}</p>
                      </div>
                    }

                    @if (review.negativeAspects.length > 0) {
                      <div class="mt-2">
                        <p class="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a2c1f]">Por qué no le gustó</p>
                        <ul class="mt-1.5 flex flex-wrap gap-1.5">
                          @for (key of review.negativeAspects; track key) {
                            <li class="rounded-full border border-[#e2b8b0] bg-[#fbe9e6] px-2.5 py-1 text-xs font-medium text-[#7a2c1f]">{{ negativeLabel(key) }}</li>
                          }
                        </ul>
                      </div>
                    }

                    @if (review.positiveAspects.length > 0) {
                      <div class="mt-2">
                        <p class="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#567088]">Qué le gustó</p>
                        <ul class="mt-1.5 flex flex-wrap gap-1.5">
                          @for (key of review.positiveAspects; track key) {
                            <li class="rounded-full bg-[#eef3f6] px-2.5 py-1 text-xs font-medium text-ink">{{ positiveLabel(key) }}</li>
                          }
                        </ul>
                      </div>
                    }
                  </div>
                </div>
              </div>
              }
            }
          }
        </div>
      </div>
    }
  `,
})
export class BookCarousel implements OnDestroy {
  readonly canPrev = signal(false);
  readonly canNext = signal(false);
  readonly selectedKey = signal<string | null>(null);
  readonly rendering = signal<BookCarouselItem | null>(null);
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  @Input() title = '';

  private _books: BookCarouselItem[] = [];
  @Input() set books(value: BookCarouselItem[]) {
    this._books = value ?? [];
    const key = this.selectedKey();
    if (key) {
      const match = this._books.find((book) => book.review != null && this.bookKey(book) === key);
      if (match) this.rendering.set(match);
    }
    requestAnimationFrame(() => this.updateScrollState());
  }
  get books(): BookCarouselItem[] {
    return this._books;
  }

  private readonly track = viewChild<ElementRef<HTMLDivElement>>('track');

  ngOnDestroy(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
  }

  bookTitle(book: BookCarouselItem): string {
    return book.title ?? book.work_id ?? book.openLibraryId ?? 'Libro sin título';
  }

  authorsOf(book: BookCarouselItem): string {
    return (book.authors ?? []).join(', ');
  }

  bookKey(book: BookCarouselItem): string {
    return book.title ?? book.work_id ?? book.openLibraryId ?? '';
  }

  toggleSelected(book: BookCarouselItem): void {
    if (!book.review) return;
    const key = this.bookKey(book);
    if (this.selectedKey() === key) {
      this.selectedKey.set(null);
      if (this.closeTimer) clearTimeout(this.closeTimer);
      this.closeTimer = setTimeout(() => {
        if (!this.selectedKey()) this.rendering.set(null);
      }, 280);
    } else {
      if (this.closeTimer) {
        clearTimeout(this.closeTimer);
        this.closeTimer = null;
      }
      this.selectedKey.set(key);
      this.rendering.set(book);
    }
  }

  onKeySpace(event: Event, book: BookCarouselItem): void {
    event.preventDefault();
    this.toggleSelected(book);
  }

  readingStatusLabel(status: string): string {
    switch (status) {
      case 'completed': return 'Lo terminó';
      case 'abandoned': return 'Lo abandonó';
      case 'in_progress': return 'En curso';
      case 'paused': return 'En pausa';
      case 'not_started': return 'No lo empezó';
      default: return status;
    }
  }

  negativeLabel(key: string): string {
    return FEEDBACK_NEGATIVE_ASPECTS[key] ?? key;
  }

  positiveLabel(key: string): string {
    return FEEDBACK_POSITIVE_ASPECTS[key] ?? key;
  }

  stars(rating: number): boolean[] {
    return [1, 2, 3, 4, 5].map((value) => value <= rating);
  }

  scroll(direction: number): void {
    const el = this.track()?.nativeElement;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: el.clientWidth * 0.8 * direction, behavior: reduce ? 'auto' : 'smooth' });
  }

  updateScrollState(): void {
    const el = this.track()?.nativeElement;
    if (!el) return;
    this.canPrev.set(el.scrollLeft > 4);
    this.canNext.set(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }
}
