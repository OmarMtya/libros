import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService, SessionDetail } from '../api.service';
import { AuthService } from '../auth.service';
import { SessionStore } from '../session-store';
import { ToastService } from '../toast.service';
import { Experience } from './experience';

@Component({
  selector: 'app-home',
  imports: [Experience],
  template: `
    @if (!store.authenticated()) {
      <section class="relative overflow-hidden bg-ink px-6 py-16 text-white sm:px-10 sm:py-24">
        <div class="pointer-events-none absolute right-[8%] top-[-46%] h-[78%] w-32 rotate-[32deg] bg-marker"></div>
        <div class="relative z-10 mx-auto max-w-3xl">
          <p class="mb-4 font-mono text-xs uppercase tracking-[0.08em] text-marker">Una selección que se lee entre líneas</p>
          <h1 class="mb-6 max-w-[14ch] font-display text-5xl font-bold leading-[0.93] tracking-[-0.06em] text-white sm:text-7xl">
            Tu próximo libro no necesita una lista. Necesita contexto.
          </h1>
          <p class="mb-6 max-w-[47ch] text-lg leading-relaxed">
            Cuéntanos cómo lees, qué buscas y qué prefieres evitar. Elegiremos una sorpresa hecha para tu momento lector.
          </p>
          @if (!auth.configured) {
            <p class="mb-6 max-w-[50ch] border-l-[3px] border-marker bg-[#173c55] px-4 py-3 text-sm">
              El acceso con Google se habilitará al conectar el proyecto de Supabase.
            </p>
          }
          <button
            class="rounded-sm bg-coral px-6 py-3 text-base font-bold text-white transition hover:bg-coral-deep disabled:cursor-wait disabled:opacity-60"
            type="button"
            (click)="signIn()"
            [disabled]="busy()">
            Empezar con Google
          </button>
        </div>
      </section>
    } @else if (questionnaireDone()) {
      <app-experience />
    } @else {
      <div class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <section class="rounded-sm border border-[#cad7df] bg-white p-10 text-center">
          <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Cargando tu ficha de lectura…</p>
        </section>
      </div>
    }
  `,
})
export class Home {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly store = inject(SessionStore);
  private readonly toast = inject(ToastService);

  readonly busy = signal(false);
  readonly sessions = signal<SessionDetail[]>([]);
  readonly questionnaireDone = computed(() => this.sessions().some((session) => session.status === 'completed'));

  private bootstrapped = false;

  constructor() {
    effect(() => {
      if (!this.auth.session()) {
        this.bootstrapped = false;
        this.sessions.set([]);
        return;
      }
      void this.bootstrap();
    });
  }

  async signIn(): Promise<void> {
    this.busy.set(true);
    try {
      await this.store.signIn();
    } finally {
      this.busy.set(false);
    }
  }

  private async bootstrap(): Promise<void> {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    try {
      const sessions = await this.api.listSessions();
      this.sessions.set(sessions);
      if (!this.questionnaireDone()) {
        await this.router.navigate(['/cuestionario']);
      }
    } catch {
      this.toast.error('No pudimos cargar tu información. Intenta de nuevo.');
    }
  }
}
