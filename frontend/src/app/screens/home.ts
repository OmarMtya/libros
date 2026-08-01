import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService, SessionDetail } from '../api.service';
import { AuthService } from '../auth.service';
import { SessionStore } from '../session-store';
import { ToastService } from '../toast.service';

type FeedbackStatus = 'completed' | 'in_progress' | 'paused' | 'abandoned' | 'not_started';

const POSITIVE_ASPECTS = [
  { key: 'story_progress', label: 'El avance de la historia' },
  { key: 'tension_curiosity', label: 'La tensión o curiosidad' },
  { key: 'characters', label: 'Los personajes' },
  { key: 'writing_style', label: 'La forma de escribir' },
  { key: 'ideas_reflection', label: 'Las ideas o reflexiones' },
];

const NEGATIVE_ASPECTS = [
  { key: 'slow_without_payoff', label: 'Fue lento sin una recompensa clara' },
  { key: 'confusing', label: 'Resultó confuso' },
  { key: 'style_too_ornate', label: 'El estilo fue demasiado recargado' },
  { key: 'too_much_introspection', label: 'Tuvo demasiada introspección' },
  { key: 'repetitive', label: 'Se sintió repetitivo' },
  { key: 'too_demanding', label: 'Exigía demasiado esfuerzo' },
];

@Component({
  selector: 'app-home',
  imports: [FormsModule],
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
    } @else {
      <div class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p class="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Tu ficha de lectura</p>
        <h1 class="mb-2 font-display text-4xl font-bold tracking-[-0.045em] text-ink sm:text-5xl">Hola, {{ store.readerName() }}.</h1>
        <p class="mb-8 text-[#536875]">Cuéntanos cómo fue la experiencia con el libro que te enviamos.</p>

        <section class="space-y-6 rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
          <h2 class="font-display text-2xl font-bold tracking-[-0.03em] text-ink">¿Empezaste el libro?</h2>
          <p class="text-sm text-[#536875]">Tus respuestas afinan tu perfil lector y mejoran las siguientes sorpresas.</p>

          <div class="flex flex-wrap gap-3">
            <button
              class="rounded-sm border px-4 py-2 text-sm font-bold transition disabled:cursor-wait"
              [class.bg-ink]="feedback.started" [class.text-white]="feedback.started"
              [class.border-ink]="feedback.started"
              [class.bg-white]="!feedback.started" [class.text-ink]="!feedback.started"
              [class.border-[#7d9ab0]]="!feedback.started"
              type="button" (click)="setStarted(true)" [disabled]="busy()">Sí</button>
            <button
              class="rounded-sm border px-4 py-2 text-sm font-bold transition disabled:cursor-wait"
              [class.bg-ink]="!feedback.started" [class.text-white]="!feedback.started"
              [class.border-ink]="!feedback.started"
              [class.bg-white]="feedback.started" [class.text-ink]="feedback.started"
              [class.border-[#7d9ab0]]="feedback.started"
              type="button" (click)="setStarted(false)" [disabled]="busy()">No lo empecé</button>
          </div>

          @if (!feedback.started) {
            <label class="block">
              <span class="text-sm font-semibold text-ink">¿Por qué no lo empezaste?</span>
              <select [(ngModel)]="feedback.notStartedReason" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                <option value="no_time">No tuve tiempo</option>
                <option value="wrong_mood">No era el momento</option>
                <option value="read_something_else">Leí otra cosa</option>
                <option value="format_or_size">Formato o tamaño</option>
                <option value="did_not_attract_me">No me atrajo</option>
                <option value="other">Otro</option>
              </select>
            </label>
          }

          @if (feedback.started) {
            <div class="grid gap-6 sm:grid-cols-2">
              <label class="block">
                <span class="text-sm font-semibold text-ink">¿En qué estado quedó?</span>
                <select [(ngModel)]="feedback.readingStatus" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                  <option value="completed">Terminado</option>
                  <option value="in_progress">En progreso</option>
                  <option value="paused">Pausado</option>
                  <option value="abandoned">Abandonado</option>
                </select>
              </label>
              <label class="block">
                <span class="text-sm font-semibold text-ink">¿Cuánto avanzaste?</span>
                <select [(ngModel)]="feedback.completionPercentage" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                  <option [ngValue]="5">5%</option>
                  <option [ngValue]="18">18%</option>
                  <option [ngValue]="38">38%</option>
                  <option [ngValue]="63">63%</option>
                  <option [ngValue]="88">88%</option>
                  <option [ngValue]="100">100%</option>
                </select>
              </label>
            </div>

            <div>
              <span class="text-sm font-semibold text-ink">¿Qué tan bien encajó contigo?</span>
              <div class="mt-2 flex gap-2">
                @for (value of [1, 2, 3, 4, 5]; track value) {
                  <button
                    class="h-11 w-11 rounded-sm border text-sm font-bold transition"
                    [class.bg-coral]="feedback.selectionFitRating === value"
                    [class.border-coral]="feedback.selectionFitRating === value"
                    [class.text-white]="feedback.selectionFitRating === value"
                    [class.border-[#9eb2c1]]="feedback.selectionFitRating !== value"
                    [class.bg-white]="feedback.selectionFitRating !== value"
                    [class.text-ink]="feedback.selectionFitRating !== value"
                    type="button" (click)="feedback.selectionFitRating = value">{{ value }}</button>
                }
              </div>
            </div>

            <div>
              <span class="text-sm font-semibold text-ink">Lo que funcionó</span>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (item of positiveAspects; track item.key) {
                  <button
                    class="rounded-full border px-3 py-1.5 text-sm transition"
                    [class.bg-ink]="feedback.positiveAspects.includes(item.key)"
                    [class.text-white]="feedback.positiveAspects.includes(item.key)"
                    [class.border-ink]="feedback.positiveAspects.includes(item.key)"
                    [class.bg-white]="!feedback.positiveAspects.includes(item.key)"
                    [class.text-ink]="!feedback.positiveAspects.includes(item.key)"
                    [class.border-[#7d9ab0]]="!feedback.positiveAspects.includes(item.key)"
                    type="button" (click)="toggleAspect('positiveAspects', item.key)">{{ item.label }}</button>
                }
              </div>
            </div>

            <div>
              <span class="text-sm font-semibold text-ink">Lo que no funcionó</span>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (item of negativeAspects; track item.key) {
                  <button
                    class="rounded-full border px-3 py-1.5 text-sm transition"
                    [class.bg-coral]="feedback.negativeAspects.includes(item.key)"
                    [class.text-white]="feedback.negativeAspects.includes(item.key)"
                    [class.border-coral]="feedback.negativeAspects.includes(item.key)"
                    [class.bg-white]="!feedback.negativeAspects.includes(item.key)"
                    [class.text-ink]="!feedback.negativeAspects.includes(item.key)"
                    [class.border-[#7d9ab0]]="!feedback.negativeAspects.includes(item.key)"
                    type="button" (click)="toggleAspect('negativeAspects', item.key)">{{ item.label }}</button>
                }
              </div>
            </div>

            <label class="block">
              <span class="text-sm font-semibold text-ink">¿A qué atribuyes el resultado?</span>
              <select [(ngModel)]="feedback.outcomeAttribution" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                <option value="mostly_book">Principalmente el libro</option>
                <option value="mixed">Mezcla</option>
                <option value="mostly_timing">Principalmente el momento</option>
                <option value="external_circumstance">Circunstancia externa</option>
                <option value="no_problem">No hubo problema</option>
              </select>
            </label>
          }

          <label class="block">
            <span class="text-sm font-semibold text-ink">Comentario opcional</span>
            <textarea
              [(ngModel)]="feedback.freeText"
              rows="4"
              class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2"
              placeholder="Cuéntanos cualquier detalle que quieras que tomemos en cuenta…"></textarea>
          </label>

          <button
            class="rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep disabled:cursor-wait disabled:opacity-60"
            type="button"
            (click)="submitFeedback()"
            [disabled]="busy()">
            Guardar feedback
          </button>
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

  readonly positiveAspects = POSITIVE_ASPECTS;
  readonly negativeAspects = NEGATIVE_ASPECTS;

  feedback = {
    started: true,
    notStartedReason: 'no_time',
    readingStatus: 'completed' as FeedbackStatus,
    completionPercentage: 100,
    selectionFitRating: 4,
    positiveAspects: [] as string[],
    negativeAspects: [] as string[],
    outcomeAttribution: 'no_problem',
    freeText: '',
  };

  private bootstrapped = false;

  constructor() {
    effect(() => {
      if (!this.auth.session()) {
        this.bootstrapped = false;
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
      const completed = sessions.some((session) => session.status === 'completed');
      if (!completed) {
        await this.router.navigate(['/cuestionario']);
      }
    } catch {
      this.toast.error('No pudimos cargar tu información. Intenta de nuevo.');
    }
  }

  setStarted(value: boolean): void {
    this.feedback.started = value;
    if (value) {
      this.feedback.readingStatus = 'in_progress';
      this.feedback.completionPercentage = 38;
    } else {
      this.feedback.readingStatus = 'not_started';
      this.feedback.completionPercentage = 0;
    }
  }

  toggleAspect(kind: 'positiveAspects' | 'negativeAspects', key: string): void {
    const values = this.feedback[kind];
    this.feedback[kind] = values.includes(key) ? values.filter((item) => item !== key) : [...values, key].slice(0, 3);
  }

  async submitFeedback(): Promise<void> {
    this.busy.set(true);
    try {
      await this.api.submitFeedback({
        ...this.feedback,
        nextDirection: {},
      });
      this.toast.success('Feedback guardado. Gracias por contarnos.');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No pudimos guardar tu feedback. Intenta de nuevo.');
    } finally {
      this.busy.set(false);
    }
  }
}
