import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { SessionStore } from '../session-store';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-paper">
      <aside class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#cad7df] bg-white md:flex">
        <a routerLink="/app/perfil" class="flex h-16 shrink-0 items-center border-b border-[#cad7df] px-5 font-mono text-[0.82rem] font-medium tracking-[0.08em] text-ink no-underline" aria-label="Mi Libro Sorpresa, inicio">
          MI LIBRO <span class="bg-coral px-1 py-0.5 text-white">SORPRESA</span>
        </a>

        <nav class="flex-1 space-y-7 overflow-y-auto px-3 py-5" aria-label="Navegación principal">
          <div>
            <p class="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#7d9ab0]">Mi cuenta</p>
            <ul class="space-y-1">
              <li><a routerLink="/app/perfil" routerLinkActive="bg-[#fbe9e6] text-coral" class="block rounded-sm px-3 py-2 text-sm font-semibold text-ink no-underline transition hover:bg-[#eef3f6] hover:text-coral">Mi perfil</a></li>
              <li><a routerLink="/app/cuestionario" routerLinkActive="bg-[#fbe9e6] text-coral" class="block rounded-sm px-3 py-2 text-sm font-semibold text-ink no-underline transition hover:bg-[#eef3f6] hover:text-coral">Mi cuestionario</a></li>
              <li><a routerLink="/app/experiencia" routerLinkActive="bg-[#fbe9e6] text-coral" class="block rounded-sm px-3 py-2 text-sm font-semibold text-ink no-underline transition hover:bg-[#eef3f6] hover:text-coral">Mi experiencia</a></li>
              <li><a routerLink="/app/mi-paquete" routerLinkActive="bg-[#fbe9e6] text-coral" class="block rounded-sm px-3 py-2 text-sm font-semibold text-ink no-underline transition hover:bg-[#eef3f6] hover:text-coral">Mi paquete</a></li>
            </ul>
          </div>

          @if (store.isAdmin()) {
            <div>
              <p class="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[#7d9ab0]">Administración</p>
              <ul class="space-y-1">
                <li><a routerLink="/app/lectores" routerLinkActive="bg-[#fbe9e6] text-coral" class="block rounded-sm px-3 py-2 text-sm font-semibold text-ink no-underline transition hover:bg-[#eef3f6] hover:text-coral">Fichas de lectores</a></li>
                <li><a routerLink="/app/admin" routerLinkActive="bg-[#fbe9e6] text-coral" class="block rounded-sm px-3 py-2 text-sm font-semibold text-ink no-underline transition hover:bg-[#eef3f6] hover:text-coral">Catálogo y envíos</a></li>
              </ul>
            </div>
          }
        </nav>

        <div class="shrink-0 border-t border-[#cad7df] px-5 py-4">
          <p class="truncate text-sm font-semibold text-ink">{{ store.readerName() }}</p>
          <button
            type="button"
            class="mt-2 rounded-sm border border-[#7d9ab0] px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-[#e6eef3] disabled:cursor-wait disabled:opacity-60"
            (click)="signOut()"
            [disabled]="busy()">Cerrar sesión</button>
        </div>
      </aside>

      <div class="md:pl-64">
        <header class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#cad7df] bg-paper/95 px-4 backdrop-blur md:hidden">
          <a routerLink="/app/perfil" class="font-mono text-[0.8rem] font-medium tracking-[0.08em] text-ink no-underline">
            MI LIBRO <span class="bg-coral px-1 py-0.5 text-white">SORPRESA</span>
          </a>
          <button
            type="button"
            class="rounded-sm border border-[#7d9ab0] px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-[#e6eef3] disabled:cursor-wait disabled:opacity-60"
            (click)="signOut()"
            [disabled]="busy()">Cerrar sesión</button>
        </header>

        <main class="pb-20 md:pb-0">
          <ng-content />
        </main>
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-[#cad7df] bg-white md:hidden" aria-label="Navegación móvil">
        <div class="flex">
          <a routerLink="/app/perfil" routerLinkActive="text-coral" class="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold text-[#52636f] no-underline">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            Perfil
          </a>
          <a routerLink="/app/cuestionario" routerLinkActive="text-coral" class="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold text-[#52636f] no-underline">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
            Cuestionario
          </a>
          <a routerLink="/app/experiencia" routerLinkActive="text-coral" class="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold text-[#52636f] no-underline">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
            Experiencia
          </a>
          <a routerLink="/app/mi-paquete" routerLinkActive="text-coral" class="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold text-[#52636f] no-underline">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
            Mi paquete
          </a>
          @if (store.isAdmin()) {
            <button type="button" (click)="moreOpen.set(!moreOpen())" class="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold text-[#52636f]">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
              Más
            </button>
          }
        </div>
      </nav>

      @if (moreOpen()) {
        <div class="fixed inset-0 z-40 md:hidden" (click)="moreOpen.set(false)"></div>
        <div class="fixed inset-x-0 bottom-[4.5rem] z-40 mx-auto w-[calc(100%-2rem)] max-w-sm rounded-sm border border-[#cad7df] bg-white p-2 shadow-lg md:hidden">
          <p class="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#7d9ab0]">Administración</p>
          <a routerLink="/app/lectores" (click)="moreOpen.set(false)" class="block rounded-sm px-3 py-2 text-sm font-semibold text-ink no-underline hover:bg-[#eef3f6] hover:text-coral">Fichas de lectores</a>
          <a routerLink="/app/admin" (click)="moreOpen.set(false)" class="block rounded-sm px-3 py-2 text-sm font-semibold text-ink no-underline hover:bg-[#eef3f6] hover:text-coral">Catálogo y envíos</a>
        </div>
      }
    </div>
  `,
})
export class AppShell {
  readonly store = inject(SessionStore);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly moreOpen = signal(false);

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth >= 768) this.moreOpen.set(false);
  }

  async signOut(): Promise<void> {
    this.busy.set(true);
    try {
      await this.store.signOut();
      await this.router.navigate(['/']);
    } finally {
      this.busy.set(false);
    }
  }
}
