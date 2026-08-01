import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SessionStore } from '../session-store';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="mx-auto flex max-w-6xl items-center justify-between border-b border-[#cad7df] px-4 py-4 sm:px-6">
      <a routerLink="/" class="font-mono text-[0.82rem] font-medium tracking-[0.08em] text-ink no-underline" aria-label="Libro sorpresa, inicio">
        LIBRO <span class="bg-coral px-1 py-0.5 text-white">SORPRESA</span>
      </a>

      @if (store.authenticated()) {
        <nav class="hidden items-center gap-5 md:flex" aria-label="Navegación principal">
          <a routerLink="/perfil" routerLinkActive="text-coral" class="text-sm font-semibold text-ink no-underline hover:text-coral">Mi perfil</a>
          @if (store.isAdmin()) {
            <a routerLink="/lectores" routerLinkActive="text-coral" class="text-sm font-semibold text-ink no-underline hover:text-coral">Fichas de lectores</a>
            <a routerLink="/admin" routerLinkActive="text-coral" class="text-sm font-semibold text-ink no-underline hover:text-coral">Catálogo y envíos</a>
          }
        </nav>
      }

      <div class="flex items-center gap-4">
        @if (store.authenticated()) {
          <span class="hidden max-w-60 truncate text-sm text-[#52636f] sm:inline">{{ store.readerName() }}</span>
          <button
            class="rounded-sm border border-[#7d9ab0] px-3 py-2 text-sm font-bold text-ink transition hover:bg-[#e6eef3] disabled:cursor-wait disabled:opacity-60"
            type="button"
            (click)="signOut()"
            [disabled]="busy()">
            Cerrar sesión
          </button>
        } @else {
          <button
            class="rounded-sm bg-ink px-4 py-2 text-sm font-bold text-white transition hover:bg-ink-soft disabled:cursor-wait disabled:opacity-60"
            type="button"
            (click)="signIn()"
            [disabled]="busy()">
            Continuar con Google
          </button>
        }
      </div>
    </header>
  `,
})
export class Header {
  readonly store = inject(SessionStore);
  readonly busy = signal(false);

  async signIn(): Promise<void> {
    this.busy.set(true);
    try {
      await this.store.signIn();
    } finally {
      this.busy.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.busy.set(true);
    try {
      await this.store.signOut();
    } finally {
      this.busy.set(false);
    }
  }
}
