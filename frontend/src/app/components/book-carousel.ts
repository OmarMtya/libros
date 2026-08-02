import { Component, ElementRef, Input, signal, viewChild } from '@angular/core';

export type BookCarouselItem = {
  title?: string;
  work_id?: string;
  openLibraryId?: string;
  authors?: string[];
  coverUrl?: string | null;
};

@Component({
  selector: 'app-book-carousel',
  imports: [],
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
          <article class="w-32 shrink-0 snap-start sm:w-36">
            <div class="aspect-[2/3] overflow-hidden rounded-sm border border-[#cad7df] bg-[#f2f6f9] shadow-[0_2px_10px_rgba(19,42,58,0.10)]">
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
    }
  `,
})
export class BookCarousel {
  readonly canPrev = signal(false);
  readonly canNext = signal(false);

  @Input() title = '';

  private _books: BookCarouselItem[] = [];
  @Input() set books(value: BookCarouselItem[]) {
    this._books = value ?? [];
    requestAnimationFrame(() => this.updateScrollState());
  }
  get books(): BookCarouselItem[] {
    return this._books;
  }

  private readonly track = viewChild<ElementRef<HTMLDivElement>>('track');

  bookTitle(book: BookCarouselItem): string {
    return book.title ?? book.work_id ?? book.openLibraryId ?? 'Libro sin título';
  }

  authorsOf(book: BookCarouselItem): string {
    return (book.authors ?? []).join(', ');
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
