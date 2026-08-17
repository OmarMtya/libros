import { NgTemplateOutlet } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, BookResult, ProfileBookInput, PublicProfile } from '../api.service';
import { AuthService } from '../auth.service';
import { BookCarousel } from '../components/book-carousel';
import { DISLIKED_BOOK_REASONS, LOVED_BOOK_ASPECTS, TAG_LABELS } from '../labels';
import { ToastService } from '../toast.service';
import { DialogService } from '../dialog.service';

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
type ShelfCategory = 'enjoyed' | 'notEnjoyed';

@Component({
  selector: 'app-public-profile',
  imports: [RouterLink, BookCarousel, FormsModule, NgTemplateOutlet],
  styles: `
    .shelf-editor-enter {
      animation: shelf-editor-in 220ms var(--ease-out);
    }

    .shelf-editor-leave {
      animation: shelf-editor-out 180ms var(--ease-out) forwards;
    }

    @keyframes shelf-editor-in {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes shelf-editor-out {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-8px); }
    }

    @media (prefers-reduced-motion: reduce) {
      .shelf-editor-enter,
      .shelf-editor-leave {
        animation: none;
      }
    }
  `,
  template: `
    <div class="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      @if (!inShell()) {
        <a routerLink="/" class="mb-8 inline-block font-mono text-[0.82rem] font-medium tracking-[0.08em] text-ink no-underline">
          MI LIBRO <span class="bg-coral px-1 py-0.5 text-white">SORPRESA</span>
        </a>
      }

      @if (loading()) {
        <section class="rounded-sm border border-[#cad7df] bg-white p-10 text-center">
          <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Cargando perfil…</p>
        </section>
      } @else if (profile(); as current) {
        <div class="space-y-6">
          <section class="rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="flex items-center gap-4">
                @if (current.isOwner) {
                  <button
                    type="button"
                    (click)="avatarInput.click()"
                    [disabled]="uploadingAvatar()"
                    class="group relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#cad7df] bg-[#eef3f6] transition hover:ring-2 hover:ring-coral disabled:opacity-60"
                    [attr.aria-label]="'Cambiar foto de perfil'">
                    @if (current.avatarUrl) {
                      <img [src]="current.avatarUrl" alt="Foto de perfil" class="h-full w-full object-cover" />
                    } @else {
                      <span class="font-display text-xl font-bold text-[#567088]">{{ initials(current.displayName) }}</span>
                    }
                    <span class="absolute inset-0 flex items-center justify-center bg-ink/45 text-white opacity-0 transition group-hover:opacity-100">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </span>
                  </button>
                  <input #avatarInput type="file" accept="image/*" class="hidden" (change)="onAvatarSelected($event)" />
                } @else {
                  <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#cad7df] bg-[#eef3f6]">
                    @if (current.avatarUrl) {
                      <img [src]="current.avatarUrl" alt="Foto de perfil" class="h-full w-full object-cover" />
                    } @else {
                      <span class="font-display text-xl font-bold text-[#567088]">{{ initials(current.displayName) }}</span>
                    }
                  </div>
                }
                <div class="min-w-0">
                  <p class="mb-1 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Perfil lector</p>
                  <h1 class="font-display text-3xl font-bold tracking-[-0.04em] text-ink sm:text-4xl">{{ current.displayName || 'Lector de Mi Libro Sorpresa' }}</h1>
                  @if (current.isOwner) {
                    <button
                      type="button"
                      (click)="editName()"
                      class="mt-3 rounded-sm border border-[#7d9ab0] px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-[#e6eef3] disabled:cursor-wait disabled:opacity-60"
                      [disabled]="loading()">
                      Editar nombre
                    </button>
                  }
                </div>
              </div>
            </div>

            @if (current.notReady) {
              <div class="mt-6 rounded-sm border border-[#f0e0b0] bg-[#fff7e6] px-5 py-4">
                <p class="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#6b5310]">Cuestionario pendiente</p>
                @if (current.isOwner) {
                  <p class="mt-2 text-sm text-[#6b5310]">Tu cuestionario está pendiente. Completa tus respuestas para que tu perfil muestre tus gustos.</p>
                  <a routerLink="/app/cuestionario" class="mt-3 inline-block rounded-sm bg-coral px-4 py-2 text-xs font-bold text-white transition hover:bg-coral-deep">Completar cuestionario</a>
                } @else {
                  <p class="mt-2 text-sm text-[#6b5310]">Este lector aún no ha completado su cuestionario. Cuando lo haga, aquí verás sus gustos y preferencias.</p>
                }
              </div>
            } @else if (current.aiDescription?.trim()) {
              <div class="mt-6 rounded-sm border border-[#cad7df] bg-[#f7fafc] px-5 py-4">
                <p class="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#567088]">Cómo leo</p>
                <p class="mt-2 text-sm leading-relaxed text-ink">{{ current.aiDescription }}</p>
              </div>
            } @else if (current.aiDescriptionStatus === 'generating') {
              <div class="mt-6 rounded-sm border border-[#cad7df] bg-[#f7fafc] px-5 py-4">
                <p class="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#567088]">Preparando tu descripción…</p>
                <div class="mt-3 h-8 animate-pulse rounded-sm bg-[#e6eef3]"></div>
              </div>
            } @else if (current.aiDescriptionStatus === 'pending' && current.isOwner) {
              <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#f0e0b0] bg-[#fff7e6] px-5 py-4">
                <p class="text-sm text-[#6b5310]">Tu descripción quedó pendiente. Puedes intentarlo de nuevo.</p>
                <button
                  type="button"
                  (click)="retryDescription()"
                  class="rounded-sm bg-coral px-4 py-2 text-xs font-bold text-white transition hover:bg-coral-deep disabled:cursor-wait disabled:opacity-60"
                  [disabled]="loading()">
                  Reintentar
                </button>
              </div>
            } @else {
              <p class="mt-6 rounded-sm border border-[#cad7df] bg-[#f7fafc] px-5 py-4 text-sm text-[#536875]">
                Aún no hay descripción de este perfil. Vuelve más tarde.
              </p>
            }
          </section>

          @if (current.currentlyReading; as reading) {
            <section class="rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
              <div class="flex items-start gap-4">
                @if (reading.coverUrl) {
                  <img [src]="reading.coverUrl" [alt]="reading.title ?? ''" class="h-24 w-16 shrink-0 rounded-sm object-cover shadow-sm" />
                }
                <div class="min-w-0">
                  <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Leyendo actualmente</p>
                  <p class="mt-1 font-display text-xl font-bold tracking-[-0.02em] text-ink">{{ reading.title || 'Libro sin título' }}</p>
                  @if (reading.author) {
                    <p class="mt-0.5 text-sm text-[#536875]">{{ reading.author }}</p>
                  }
                </div>
              </div>
            </section>
          }

          <section class="rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
            <h2 class="mb-3 text-sm font-bold uppercase tracking-wider text-ink">Categorías</h2>
            @if (current.notReady) {
              <p class="text-sm text-[#7d9ab0]">Sin responder aún. Se mostrarán al completar el cuestionario.</p>
            } @else {
              <div class="space-y-3 text-sm">
              <p><strong class="text-ink">Me gustan:</strong>
                @for (tag of current.categories.liked; track tag.key) {
                  <span class="ml-2 my-1 inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-ink">{{ categoryLabel(tag) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin categorías declaradas.</span> }
              </p>
              <p><strong class="text-ink">Me dan curiosidad:</strong>
                @for (tag of current.categories.curious; track tag.key) {
                  <span class="ml-2 my-1 inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-ink">{{ categoryLabel(tag) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin categorías declaradas.</span> }
              </p>
              <p><strong class="text-ink">No me interesan por ahora:</strong>
                @for (tag of current.categories.notInterested; track tag.key) {
                  <span class="ml-2 my-1 inline-flex rounded-full bg-[#fbe9e6] px-3 py-1 text-[#7a2c1f]">{{ categoryLabel(tag) }}</span>
                } @empty { <span class="ml-2 text-[#7d9ab0]">Sin categorías declaradas.</span> }
              </p>
            </div>
            }

            <h2 class="mb-2 mt-8 text-sm font-bold uppercase tracking-wider text-ink">Libros</h2>
             <div class="space-y-8">
               <div>
                 <app-book-carousel title="Disfrutados" [actionLabel]="current.isOwner && !current.notReady ? '+ Agregar' : null" [actionAriaLabel]="current.isOwner && !current.notReady ? 'Agregar un libro a Me gustan' : ''" [canRemove]="current.isOwner && !current.notReady" [books]="current.books.enjoyed" (action)="openShelfEditor('enjoyed')" (remove)="removeProfileBook($event)" (edit)="editProfileBook('enjoyed', $event)">
                   @if (shelfEditor() === 'enjoyed') {
                     <ng-container book-carousel-action-content [ngTemplateOutlet]="shelfEditorTemplate" [ngTemplateOutletContext]="{ $implicit: 'enjoyed' }" />
                   }
                 </app-book-carousel>
               </div>
               <div>
                 <app-book-carousel title="No disfrutados o abandonados" [actionLabel]="current.isOwner && !current.notReady ? '+ Agregar' : null" [actionAriaLabel]="current.isOwner && !current.notReady ? 'Agregar un libro a No me gustaron' : ''" [canRemove]="current.isOwner && !current.notReady" [books]="current.books.notEnjoyed" (action)="openShelfEditor('notEnjoyed')" (remove)="removeProfileBook($event)" (edit)="editProfileBook('notEnjoyed', $event)">
                   @if (shelfEditor() === 'notEnjoyed') {
                     <ng-container book-carousel-action-content [ngTemplateOutlet]="shelfEditorTemplate" [ngTemplateOutletContext]="{ $implicit: 'notEnjoyed' }" />
                   }
                 </app-book-carousel>
               </div>
             </div>

             <ng-template #shelfEditorTemplate let-category>
                <section class="mt-5 rounded-sm border border-[#cad7df] bg-[#f7fafc]" animate.enter="shelf-editor-enter" animate.leave="shelf-editor-leave" aria-labelledby="shelf-editor-title" aria-describedby="shelf-editor-message">
                 <header class="flex items-start justify-between gap-4 border-b border-[#e6eef3] px-4 py-4 sm:px-5">
                   <div>
                     <p class="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[#567088]">Tu estantería</p>
                     <h3 id="shelf-editor-title" class="mt-1 font-display text-xl font-bold tracking-[-0.03em] text-ink">Agregar a {{ shelfCategoryLabel(category) }}</h3>
                     <p id="shelf-editor-message" class="mt-2 text-sm leading-relaxed text-[#536875]">Busca los libros que ya leíste y completa los detalles de cada uno.</p>
                   </div>
                   <button type="button" (click)="closeShelfEditor()" class="-m-1 shrink-0 p-1 text-[#7d9ab0] transition hover:text-coral" aria-label="Cerrar editor de estantería">
                     <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                   </button>
                 </header>

                 <div class="px-4 py-5 sm:px-5">
                   @if (pendingBooks().length > 0) {
                     <div class="rounded-sm border border-[#cad7df] bg-white p-3">
                       <div class="flex items-center justify-between gap-3">
                         <p class="text-xs font-bold uppercase tracking-wider text-[#567088]">Por guardar</p>
                         <span class="font-mono text-[10px] text-[#567088]">{{ pendingBooks().length }} {{ pendingBooks().length === 1 ? 'libro' : 'libros' }}</span>
                       </div>
                       <div class="mt-2 space-y-3">
                         @for (book of pendingBooks(); track book.openLibraryId) {
                           <div class="rounded-sm border border-[#cad7df] bg-white p-4">
                             <div class="flex items-start justify-between gap-3">
                               <div class="min-w-0">
                                 <p class="truncate text-sm font-bold text-ink">{{ book.title }}</p>
                                 <p class="truncate text-xs text-[#536875]">{{ book.authors.join(', ') || 'Autor desconocido' }}</p>
                               </div>
                               <button type="button" (click)="removePendingBook(book.openLibraryId)" class="shrink-0 text-xs font-bold text-[#7a2c1f] hover:underline">Quitar</button>
                             </div>

                             @if (category === 'enjoyed') {
                               <p class="mt-3 text-sm font-semibold text-ink">¿Qué te gustó de este libro?</p>
                               <div class="mt-2 flex flex-wrap gap-2">
                                 @for (aspect of lovedBookAspects; track aspect.key) {
                                   <button type="button" class="rounded-full border px-3 py-1 text-sm transition" [attr.aria-pressed]="hasPendingBookAspect(book, aspect.key)" [class.bg-ink]="hasPendingBookAspect(book, aspect.key)" [class.text-white]="hasPendingBookAspect(book, aspect.key)" [class.border-ink]="hasPendingBookAspect(book, aspect.key)" [class.bg-white]="!hasPendingBookAspect(book, aspect.key)" [class.border-[#7d9ab0]]="!hasPendingBookAspect(book, aspect.key)" (click)="togglePendingBookAspect(book, aspect.key)">{{ aspect.label }}</button>
                                 }
                               </div>
                             } @else {
                               <p class="mt-3 text-sm font-semibold text-ink">¿Qué no funcionó?</p>
                               <div class="mt-2 flex flex-wrap gap-2">
                                 @for (reason of dislikedBookReasons; track reason.key) {
                                   <button type="button" class="rounded-full border px-3 py-1 text-sm transition" [attr.aria-pressed]="hasPendingBookReason(book, reason.key)" [class.bg-coral]="hasPendingBookReason(book, reason.key)" [class.text-white]="hasPendingBookReason(book, reason.key)" [class.border-coral]="hasPendingBookReason(book, reason.key)" [class.bg-white]="!hasPendingBookReason(book, reason.key)" [class.border-[#7d9ab0]]="!hasPendingBookReason(book, reason.key)" (click)="togglePendingBookReason(book, reason.key)">{{ reason.label }}</button>
                                 }
                               </div>
                             }

                             <p class="mt-4 text-sm font-semibold text-ink">¿Cuánto te gustó?</p>
                             <div class="mt-2 flex items-center gap-2">
                               @for (value of [1, 2, 3, 4, 5]; track value) {
                                 <button type="button" class="h-10 w-10 rounded-full border text-sm font-bold transition" [attr.aria-pressed]="book.rating === value" [class.bg-coral]="book.rating === value" [class.text-white]="book.rating === value" [class.border-coral]="book.rating === value" [class.bg-white]="book.rating !== value" [class.text-ink]="book.rating !== value" [class.border-[#7d9ab0]]="book.rating !== value" (click)="book.rating = value">{{ value }}</button>
                               }
                             </div>
                             <p class="mt-1 text-xs text-[#567088]">1 = {{ category === 'enjoyed' ? 'Me gustó poco' : 'No era para mí' }} · 5 = Me encantó</p>
                             @if (category === 'enjoyed' && book.rating >= 1 && book.rating <= 2) {
                               <p class="mt-2 rounded-sm border-l-[3px] border-[#f59e0b] bg-[#fff7e6] px-3 py-2 text-sm leading-relaxed text-[#8a5a12]">¿Menos de 3 estrellas? Un favorito con una nota tan baja se vuelve ambiguo y nos cuesta más detectar si de verdad te gustó. Si no te gustó tanto, quizá encaja mejor en la otra lista.</p>
                             }
                             @if (category === 'notEnjoyed' && book.rating >= 4) {
                               <p class="mt-2 rounded-sm border-l-[3px] border-[#f59e0b] bg-[#fff7e6] px-3 py-2 text-sm leading-relaxed text-[#8a5a12]">¿Te encantó (4–5)? Entonces quizá este libro va mejor en la lista de los que sí te gustaron.</p>
                             }
                             <label class="mt-3 block">
                               <span class="text-sm font-semibold text-ink">Comentario opcional</span>
                               <input [(ngModel)]="book.freeText" maxlength="2000" placeholder="Cuéntanos cualquier detalle…" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                             </label>
                           </div>
                         }
                       </div>
                       @if (!pendingBooksValid()) {
                         <p class="mt-3 text-xs text-[#7a2c1f]">Completa los motivos o aspectos y la calificación de cada libro antes de guardar.</p>
                       }
                     </div>
                   }

                   <div class="mt-5">
                     <label for="profile-book-search" class="sr-only">Buscar un libro leído</label>
                     <input id="profile-book-search" type="search" autocomplete="off" [ngModel]="bookQuery" (ngModelChange)="onBookQueryChanged($event)" placeholder="Busca un título para agregarlo…" class="w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20" />
                     @if (bookSearchLoading()) { <p class="mt-2 text-xs text-[#567088]">Buscando…</p> }
                     @if (bookResults().length > 0) {
                       <div class="mt-2 max-h-72 overflow-y-auto rounded-sm border border-[#cad7df] bg-white">
                         @for (book of bookResults(); track book.openLibraryId) {
                           <button type="button" (click)="addBookToShelf(book)" class="flex w-full items-center gap-3 border-b border-[#e6eef3] px-3 py-3 text-left transition last:border-b-0 hover:bg-[#f7fafc]">
                             @if (book.coverUrl) { <img [src]="book.coverUrl" [alt]="book.title" class="h-12 w-8 shrink-0 rounded-sm object-cover" /> } @else { <span class="flex h-12 w-8 shrink-0 items-center justify-center rounded-sm bg-[#e6eef3] text-[10px] text-[#567088]">LIBRO</span> }
                             <span class="min-w-0"><span class="block truncate text-sm font-bold text-ink">{{ book.title }}</span><span class="block truncate text-xs text-[#536875]">{{ book.authors.join(', ') || 'Autor desconocido' }}</span></span>
                           </button>
                         }
                       </div>
                     }
                   </div>
                 </div>

                 <footer class="flex items-center justify-between gap-3 border-t border-[#e6eef3] bg-white px-4 py-3 sm:px-5">
                   <button type="button" (click)="closeShelfEditor()" class="rounded-sm border border-[#7d9ab0] px-4 py-2.5 text-xs font-bold text-ink transition hover:bg-[#e6eef3]">Cerrar</button>
                   <button type="button" (click)="savePendingBooks()" [disabled]="loading() || pendingBooks().length === 0 || !pendingBooksValid()" class="rounded-sm bg-coral px-4 py-2.5 text-xs font-bold text-white transition hover:bg-coral-deep disabled:cursor-not-allowed disabled:opacity-50">Guardar en {{ shelfCategoryLabel(category) }}</button>
                 </footer>
               </section>
             </ng-template>

            @if (current.constraints; as constraints) {
              <h2 class="mb-2 mt-8 text-sm font-bold uppercase tracking-wider text-ink">Preferencias</h2>
              <div class="flex flex-wrap gap-2">
                @if (constraints.preferredPagesMin != null && constraints.preferredPagesMax != null) {
                  <span class="inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-sm text-ink">
                    De {{ constraints.preferredPagesMin }} a {{ constraints.preferredPagesMax }} páginas
                  </span>
                }
                <span class="inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-sm text-ink">
                  Sagas: {{ seriesLabel(constraints.seriesPreference) }}
                </span>
                @for (language of constraints.languages; track language) {
                  <span class="inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-sm text-ink">{{ languageLabel(language) }}</span>
                }
                @for (format of constraints.formats; track format) {
                  <span class="inline-flex rounded-full bg-[#eef3f6] px-3 py-1 text-sm text-ink">{{ formatLabel(format) }}</span>
                }
              </div>
            }
          </section>

        </div>
      } @else {
        <section class="rounded-sm border border-[#cad7df] bg-white p-10 text-center">
          <h2 class="font-display text-2xl font-bold tracking-[-0.03em] text-ink">Perfil no encontrado</h2>
          <p class="mt-2 text-sm text-[#536875]">El enlace no es válido o el perfil ya no está disponible.</p>
          <a routerLink="/" class="mt-5 inline-block rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep">
            Volver al inicio
          </a>
        </section>
      }
    </div>
  `,
})
export class PublicProfileScreen {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(DialogService);

  readonly profile = signal<PublicProfile | null>(null);
  readonly loading = signal(false);
  readonly uploadingAvatar = signal(false);
  readonly inShell = signal(false);
  readonly bookResults = signal<BookResult[]>([]);
  readonly bookSearchLoading = signal(false);
  readonly pendingBooks = signal<ProfileBookInput[]>([]);
  readonly shelfEditor = signal<ShelfCategory | null>(null);
  bookQuery = '';
  private bookSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private bookSearchRequest = 0;
  private slug: string | null = null;
  private pollToken = 0;
  private pollTries = 0;

  readonly lovedBookAspects = LOVED_BOOK_ASPECTS;
  readonly dislikedBookReasons = DISLIKED_BOOK_REASONS;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      const path = this.route.snapshot.routeConfig?.path ?? '';
      this.inShell.set(path.startsWith('app/'));
      if (slug) {
        this.slug = slug;
        void this.load(slug);
      }
    });
  }

  initials(name: string | null): string {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'L';
    return parts.slice(0, 2).map((part) => part[0]!.toUpperCase()).join('');
  }

  categoryLabel(tag: { key: string; label: string }): string {
    return TAG_LABELS[tag.key] ?? tag.label;
  }

  seriesLabel(value: string | null): string {
    switch (value) {
      case 'standalone_only': return 'solo autoconclusivos';
      case 'standalone_preferred': return 'prefiero autoconclusivos';
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

  async editName(): Promise<void> {
    const value = await this.dialog.prompt({
      title: 'Editar nombre',
      message: 'Así te verán quienes visiten tu perfil.',
      inputLabel: 'Nombre',
      placeholder: 'Tu nombre',
      initialValue: this.profile()?.displayName?.trim() ?? '',
      confirmLabel: 'Guardar',
    });
    if (value === null || !value.trim()) return;
    await this.run(async () => {
      await this.auth.updateName(value);
      await this.api.getMe();
      if (this.slug) await this.load(this.slug);
      this.toast.success('Nombre actualizado.');
    });
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.toast.error('Selecciona una imagen.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.toast.error('La imagen debe pesar menos de 3 MB.');
      return;
    }
    this.uploadingAvatar.set(true);
    try {
      const url = await this.auth.replaceAvatar(file);
      await this.api.updateAvatar(url);
      if (this.slug) await this.load(this.slug);
      this.toast.success('Foto de perfil actualizada.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No pudimos subir tu foto.');
    } finally {
      this.uploadingAvatar.set(false);
    }
  }

  onBookQueryChanged(query: string): void {
    this.bookQuery = query;
    const request = ++this.bookSearchRequest;
    if (this.bookSearchTimer) clearTimeout(this.bookSearchTimer);
    if (query.trim().length < 2) {
      this.bookResults.set([]);
      this.bookSearchLoading.set(false);
      return;
    }
    this.bookSearchTimer = setTimeout(() => {
      this.bookSearchTimer = null;
      void this.searchAdditionalBooks(query, request);
    }, 300);
  }

  shelfCategoryLabel(category: ShelfCategory): string {
    return category === 'enjoyed' ? 'Me gustan' : 'No me gustaron';
  }

  openShelfEditor(category: ShelfCategory): void {
    if (this.shelfEditor() === category) {
      this.closeShelfEditor();
      return;
    }
    this.shelfEditor.set(category);
    this.pendingBooks.set([]);
    this.bookQuery = '';
    this.bookResults.set([]);
  }

  editProfileBook(category: ShelfCategory, book: { profileBookId?: string; title?: string; authors?: string[]; coverUrl?: string | null; review?: { selectionFitRating: number | null; positiveAspects: string[]; negativeAspects: string[]; freeText: string | null } | null }): void {
    if (!book.profileBookId) return;
    const review = book.review;
    this.shelfEditor.set(category);
    this.pendingBooks.set([{
      category,
      openLibraryId: book.profileBookId,
      openLibraryEditionId: null,
      coverId: null,
      title: book.title ?? 'Libro sin título',
      authors: book.authors ?? [],
      coverUrl: book.coverUrl ?? null,
      rating: review?.selectionFitRating ?? 0,
      likedAspects: [...(review?.positiveAspects ?? [])],
      reasonCodes: [...(review?.negativeAspects ?? [])],
      freeText: review?.freeText ?? '',
    }]);
    this.bookQuery = '';
    this.bookResults.set([]);
  }

  closeShelfEditor(): void {
    this.shelfEditor.set(null);
    this.pendingBooks.set([]);
    this.bookQuery = '';
    this.bookResults.set([]);
  }

  private async searchAdditionalBooks(query: string, request: number): Promise<void> {
    this.bookSearchLoading.set(true);
    try {
      const results = await this.api.searchBooks(query.trim(), 6);
      if (request === this.bookSearchRequest && this.bookQuery.trim() === query.trim()) this.bookResults.set(results);
    } catch (error) {
      if (request === this.bookSearchRequest && this.bookQuery.trim() === query.trim()) {
        this.bookResults.set([]);
        this.toast.error(error instanceof Error ? error.message : 'No pudimos buscar libros.');
      }
    } finally {
      if (request === this.bookSearchRequest) this.bookSearchLoading.set(false);
    }
  }

  addBookToShelf(book: BookResult): void {
    const category = this.shelfEditor();
    if (!category) return;
    const key = book.openLibraryId.toLowerCase();
    if (this.pendingBooks().some((item) => item.openLibraryId.toLowerCase() === key)) {
      this.toast.error('Ese libro ya está en tu lista por guardar.');
      return;
    }
    this.pendingBooks.update((books) => [...books, {
      category,
      openLibraryId: book.openLibraryId,
      openLibraryEditionId: book.openLibraryEditionId,
      coverId: book.coverId,
      title: book.title,
      authors: book.authors,
      coverUrl: book.coverUrl,
      rating: 0,
      likedAspects: [],
      reasonCodes: [],
      freeText: '',
    }]);
    this.bookQuery = '';
    this.bookResults.set([]);
  }

  removePendingBook(openLibraryId: string): void {
    this.pendingBooks.update((books) => books.filter((book) => book.openLibraryId !== openLibraryId));
  }

  togglePendingBookAspect(book: ProfileBookInput, aspect: string): void {
    book.likedAspects = book.likedAspects.includes(aspect)
      ? book.likedAspects.filter((item) => item !== aspect)
      : [...book.likedAspects, aspect];
  }

  hasPendingBookAspect(book: ProfileBookInput, aspect: string): boolean {
    return book.likedAspects.includes(aspect);
  }

  togglePendingBookReason(book: ProfileBookInput, reason: string): void {
    book.reasonCodes = book.reasonCodes.includes(reason)
      ? book.reasonCodes.filter((item) => item !== reason)
      : [...book.reasonCodes, reason];
  }

  hasPendingBookReason(book: ProfileBookInput, reason: string): boolean {
    return book.reasonCodes.includes(reason);
  }

  pendingBooksValid(): boolean {
    return this.pendingBooks().every((book) => book.rating >= 1 && book.rating <= 5
      && (book.category === 'enjoyed' ? book.likedAspects.length > 0 : book.reasonCodes.length > 0));
  }

  private pendingBooksValidationMessage(): string | null {
    const missingDetails = this.pendingBooks().find((book) => book.category === 'enjoyed' ? book.likedAspects.length === 0 : book.reasonCodes.length === 0);
    if (missingDetails) return missingDetails.category === 'enjoyed'
      ? `Selecciona qué te gustó de «${missingDetails.title}».`
      : `Selecciona el motivo de «${missingDetails.title}».`;
    const missingRating = this.pendingBooks().find((book) => book.rating < 1 || book.rating > 5);
    return missingRating ? `Califica «${missingRating.title}» de 1 a 5.` : null;
  }

  async savePendingBooks(): Promise<void> {
    const books = this.pendingBooks();
    if (books.length === 0) return;
    const validation = this.pendingBooksValidationMessage();
    if (validation) {
      this.toast.error(validation);
      return;
    }
    await this.run(async () => {
      await this.api.addProfileBooks(books);
      await this.refresh();
      this.closeShelfEditor();
      this.toast.success('Estantería actualizada.');
    });
  }

  async removeProfileBook(book: { profileBookId?: string; title?: string }): Promise<void> {
    const openLibraryId = book.profileBookId;
    if (!openLibraryId) return;
    const confirmed = await this.dialog.confirm({
      title: 'Quitar libro',
      message: `¿Quieres quitar «${book.title ?? 'este libro'}» de tu estantería?`,
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!confirmed) return;
    await this.run(async () => {
      await this.api.removeProfileBook(openLibraryId);
      await this.refresh();
      this.toast.success('Libro quitado de tu estantería.');
    });
  }

  async retryDescription(): Promise<void> {
    await this.run(async () => {
      await this.api.regenerateDescription();
      if (this.slug) await this.load(this.slug);
      this.pollTries = 0;
      this.scheduleDescriptionPoll();
    });
  }

  private async load(slug: string): Promise<void> {
    this.loading.set(true);
    try {
      const profile = await this.api.getPublicProfile(slug).catch((error) => {
        if (error && error.status === 404) return null;
        throw error;
      });
      this.profile.set(profile);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No pudimos cargar el perfil.');
    } finally {
      this.loading.set(false);
    }
    this.scheduleDescriptionPoll();
  }

  private async refresh(): Promise<void> {
    if (!this.slug) return;
    const profile = await this.api.getPublicProfile(this.slug).catch((error) => {
      if (error && error.status === 404) return null;
      throw error;
    });
    if (profile) this.profile.set(profile);
  }

  private scheduleDescriptionPoll(): void {
    const token = ++this.pollToken;
    if (this.profile()?.aiDescriptionStatus !== 'generating') return;
    const attempt = () => {
      if (token !== this.pollToken) return;
      if (this.profile()?.aiDescriptionStatus !== 'generating') return;
      void this.refresh().then(() => {
        if (token !== this.pollToken) return;
        if (this.profile()?.aiDescriptionStatus === 'generating') {
          if (this.pollTries < 4) {
            this.pollTries++;
            setTimeout(attempt, 3000);
          }
        }
      });
    };
    setTimeout(attempt, 3000);
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
