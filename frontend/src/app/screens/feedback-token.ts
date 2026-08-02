import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';

type FeedbackStatus = 'completed' | 'in_progress' | 'paused' | 'abandoned' | 'not_started';

type FeedbackForm = {
  started: boolean;
  notStartedReason: string | null;
  readingStatus: FeedbackStatus;
  completionPercentage: number;
  positiveAspects: string[];
  negativeAspects: string[];
  selectionFitRating: number | null;
  outcomeAttribution: string | null;
  freeText: string;
};

const POSITIVE_ASPECTS = [
  { key: 'story_progress', label: 'El avance de la historia' },
  { key: 'tension_curiosity', label: 'La tensión o curiosidad' },
  { key: 'characters', label: 'Los personajes' },
  { key: 'writing_style', label: 'La forma de escribir' },
  { key: 'ideas_reflection', label: 'Las ideas o reflexiones' },
  { key: 'atmosphere', label: 'La atmósfera' },
];

const NEGATIVE_ASPECTS = [
  { key: 'slow_without_payoff', label: 'Fue lento sin una recompensa clara' },
  { key: 'confusing', label: 'Resultó confuso' },
  { key: 'style_too_ornate', label: 'El estilo fue demasiado recargado' },
  { key: 'too_much_introspection', label: 'Tuvo demasiada introspección' },
  { key: 'repetitive', label: 'Se sintió repetitivo' },
  { key: 'too_demanding', label: 'Exigía demasiado esfuerzo' },
  { key: 'topic_no_interest', label: 'No me interesó el tema' },
];

const COMPLETION_STEPS = [5, 18, 38, 63, 88, 100];
const COMPLETION_LABELS: Record<number, string> = {
  5: 'Apenas lo empecé',
  18: 'Leí una parte',
  38: 'Menos de la mitad',
  63: 'Más de la mitad',
  88: 'Casi lo terminé',
  100: 'Lo terminé',
};

@Component({
  selector: 'app-feedback-token',
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      @if (invalid()) {
        <section class="rounded-sm border border-[#e2c3c0] bg-[#fdf3f2] p-8 text-center">
          <h1 class="font-display text-3xl font-bold tracking-[-0.03em] text-ink">Invitación no válida</h1>
          <p class="mt-2 text-[#536875]">{{ invalidMessage() }}</p>
        </section>
      } @else if (received()) {
        <section class="rounded-sm border border-[#cad7df] bg-white p-8 text-center">
          <h1 class="font-display text-3xl font-bold tracking-[-0.03em] text-ink">Feedback recibido</h1>
          <p class="mt-2 text-[#536875]">Gracias por contarnos cómo te fue con este libro.</p>
        </section>
      } @else if (loading()) {
        <section class="rounded-sm border border-[#cad7df] bg-white p-10 text-center">
          <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Cargando invitación…</p>
        </section>
      } @else if (book()) {
        <p class="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Tu ficha de lectura</p>
        <h1 class="mb-2 font-display text-4xl font-bold tracking-[-0.045em] text-ink sm:text-5xl">Cuéntanos cómo te fue con «{{ book()!.title }}»</h1>
        <p class="mb-4 text-[#536875]">
          @for (author of book()!.authors; track author) { {{ author }}{{ $last ? '' : ', ' }} }
          @if (book()!.contributors.length > 0) {
            · Trad. @for (contributor of book()!.contributors; track contributor) { {{ contributor }}{{ $last ? '' : ', ' }} }
          }
        </p>

        @if (tooEarlyToAnswer()) {
          <section class="mb-6 rounded-sm border border-[#e2d5a8] bg-[#fbf6e3] p-4 text-sm text-[#6b5d2a]">
            <p class="font-bold">Parece que te acaba de llegar.</p>
            <p class="mt-1">No hay prisa: tómate unos días para leerlo si lo necesitas. Aun así, puedes responder ahora si ya tienes una impresión.</p>
          </section>
        }

        <section class="mb-6 rounded-sm border border-[#cad7df] bg-[#eef4f8] p-4 text-sm text-[#3c5568]">
          <h2 class="font-display text-lg font-bold tracking-[-0.03em] text-ink">Responde cuando termines o abandones el libro</h2>
          <p class="mt-1">
            Cuando termines el libro —o si no lo terminas y en algún momento quieres volver a pedir otro—, responde esta
            encuesta: es lo que usamos para seguir aprendiendo de tu lectura y afinar tus próximas sorpresas.
          </p>
        </section>

        <section class="space-y-6 rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
          <div class="flex flex-wrap gap-3">
            <button type="button" class="rounded-sm border px-4 py-2 text-sm font-bold transition" [class.bg-ink]="feedback.started" [class.text-white]="feedback.started" [class.border-ink]="feedback.started" [class.bg-white]="!feedback.started" [class.text-ink]="!feedback.started" [class.border-[#7d9ab0]]="!feedback.started" (click)="setStarted(true)">Sí lo empecé</button>
            <button type="button" class="rounded-sm border px-4 py-2 text-sm font-bold transition" [class.bg-ink]="!feedback.started" [class.text-white]="!feedback.started" [class.border-ink]="!feedback.started" [class.bg-white]="feedback.started" [class.text-ink]="feedback.started" [class.border-[#7d9ab0]]="feedback.started" (click)="setStarted(false)">No lo empecé</button>
          </div>

          @if (!feedback.started) {
            <label class="block">
              <span class="text-sm font-semibold text-ink">¿Por qué no lo empezaste?<span class="ml-0.5 text-coral">*</span></span>
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
            <label class="block">
              <span class="text-sm font-semibold text-ink">¿Cuánto avanzaste?</span>
              <input type="range" min="5" max="100" step="1" [value]="feedback.completionPercentage" (input)="onCompletionInput($event)" (change)="onCompletionChange($event)" aria-label="Cuánto avanzaste" class="mt-4 w-full accent-coral" />
              <div class="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-[#567088]">
                <span>Inicio</span>
                <span>Fin</span>
              </div>
              <p class="mt-3 text-center text-sm font-bold text-ink">{{ completionLabel() }}</p>
            </label>

            <div>
              <span class="text-sm font-semibold text-ink">Lo que SÍ me gustó<span class="ml-0.5 text-coral">*</span></span>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (item of positiveAspects; track item.key) {
                  <button type="button" class="rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40" [class.bg-ink]="feedback.positiveAspects.includes(item.key)" [class.text-white]="feedback.positiveAspects.includes(item.key)" [class.border-ink]="feedback.positiveAspects.includes(item.key)" [class.bg-white]="!feedback.positiveAspects.includes(item.key)" [class.text-ink]="!feedback.positiveAspects.includes(item.key)" [class.border-[#7d9ab0]]="!feedback.positiveAspects.includes(item.key)" [disabled]="aspectDisabled('positiveAspects', item.key)" (click)="toggleAspect('positiveAspects', item.key)">{{ item.label }}</button>
                }
              </div>
            </div>

            <div>
              <span class="text-sm font-semibold text-ink">Lo que NO me gustó<span class="ml-0.5 text-coral">*</span></span>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (item of negativeAspects; track item.key) {
                  <button type="button" class="rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40" [class.bg-coral]="feedback.negativeAspects.includes(item.key)" [class.text-white]="feedback.negativeAspects.includes(item.key)" [class.border-coral]="feedback.negativeAspects.includes(item.key)" [class.bg-white]="!feedback.negativeAspects.includes(item.key)" [class.text-ink]="!feedback.negativeAspects.includes(item.key)" [class.border-[#7d9ab0]]="!feedback.negativeAspects.includes(item.key)" [disabled]="aspectDisabled('negativeAspects', item.key)" (click)="toggleAspect('negativeAspects', item.key)">{{ item.label }}</button>
                }
              </div>
            </div>

            <label class="block">
              <span class="text-sm font-semibold text-ink">¿Qué hizo que te gustara o no el libro?<span class="ml-0.5 text-coral">*</span></span>
              <select [(ngModel)]="feedback.outcomeAttribution" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2">
                <option value="" disabled>Selecciona una opción</option>
                <option value="mostly_book">Principalmente el libro</option>
                <option value="mixed">Mezcla</option>
                <option value="mostly_timing">Principalmente el momento</option>
                <option value="external_circumstance">Circunstancia externa</option>
                <option value="no_problem">Nada en particular</option>
              </select>
            </label>

            <div>
              <span class="text-sm font-semibold text-ink">¿Qué tan buena fue la selección para ti?<span class="ml-0.5 text-coral">*</span></span>
              <div class="mt-2 flex items-center gap-2">
                @for (score of [1, 2, 3, 4, 5]; track score) {
                  <button type="button" class="h-10 w-10 rounded-full border text-sm font-bold transition" [class.bg-coral]="feedback.selectionFitRating === score" [class.text-white]="feedback.selectionFitRating === score" [class.border-coral]="feedback.selectionFitRating === score" [class.bg-white]="feedback.selectionFitRating !== score" [class.text-ink]="feedback.selectionFitRating !== score" [class.border-[#7d9ab0]]="feedback.selectionFitRating !== score" (click)="feedback.selectionFitRating = score">{{ score }}</button>
                }
              </div>
              <p class="mt-1 text-xs text-[#567088]">1 = No era para mí · 5 = Me encantó</p>
            </div>
          }

          <label class="block">
            <span class="text-sm font-semibold text-ink">Comentario opcional</span>
            <textarea [(ngModel)]="feedback.freeText" rows="4" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2" placeholder="Cuéntanos cualquier detalle…"></textarea>
          </label>

          @if (feedback.started && feedback.positiveAspects.length === 0 && feedback.negativeAspects.length === 0) {
            <p class="mt-4 text-xs text-coral-deep">Selecciona al menos un aspecto, ya sea de "Lo que SÍ me gustó" o de "Lo que NO me gustó".</p>
          }

          <div class="flex justify-end">
            <button type="button" class="rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep disabled:opacity-60" (click)="submit()" [disabled]="submitting() || !canSubmit()">Enviar feedback</button>
          </div>
          @if (!canSubmit()) {
            <p class="mt-2 text-xs text-[#567088]">
              @if (!feedback.started) {
                Selecciona el motivo por el que no lo empezaste para enviar.
              }
            </p>
          }
        </section>
      }
    </div>
  `,
})
export class FeedbackToken {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly positiveAspects = POSITIVE_ASPECTS;
  readonly negativeAspects = NEGATIVE_ASPECTS;

  readonly book = signal<{ title: string; editionTitle: string; languageCode: string; authors: string[]; contributors: string[] } | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly received = signal(false);
  readonly invalid = signal(false);
  readonly invalidMessage = signal('La invitación no es válida o ya fue utilizada.');
  readonly dragValue = signal(100);
  private deliveryChangedAt: string | null = null;

  readonly tooEarlyToAnswer = () => {
    if (!this.deliveryChangedAt) return false;
    const changed = new Date(this.deliveryChangedAt);
    const now = new Date();
    return (
      changed.getFullYear() === now.getFullYear() &&
      changed.getMonth() === now.getMonth() &&
      changed.getDate() === now.getDate()
    );
  };

  feedback: FeedbackForm = {
    started: true,
    notStartedReason: null,
    readingStatus: 'completed' as FeedbackStatus,
    completionPercentage: 100,
    positiveAspects: [] as string[],
    negativeAspects: [] as string[],
    selectionFitRating: null,
    outcomeAttribution: null,
    freeText: '',
  };

  private token = '';

  constructor() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const result = await this.api.getFeedbackInvitation(this.token);
      this.deliveryChangedAt = result.deliveryChangedAt;
      if (result.received) {
        this.received.set(true);
      } else {
        this.book.set(result.book);
      }
    } catch (error) {
      this.invalid.set(true);
      this.invalidMessage.set(error instanceof Error ? error.message : 'La invitación no es válida.');
      this.toast.error(error instanceof Error ? error.message : 'La invitación no es válida.');
    } finally {
      this.loading.set(false);
    }
  }

  setStarted(value: boolean): void {
    this.feedback.started = value;
    if (value) {
      this.feedback.readingStatus = 'completed';
      this.feedback.completionPercentage = 100;
      this.feedback.notStartedReason = null;
    } else {
      this.feedback.readingStatus = 'not_started';
      this.feedback.completionPercentage = 0;
      this.feedback.selectionFitRating = null;
    }
    this.dragValue.set(this.feedback.completionPercentage);
  }

  onCompletionInput(event: Event): void {
    this.dragValue.set(Number((event.target as HTMLInputElement).value));
  }

  onCompletionChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.feedback.completionPercentage = this.nearestCompletionStep(value);
    this.feedback.readingStatus = this.feedback.completionPercentage === 100 ? 'completed' : 'abandoned';
    this.dragValue.set(this.feedback.completionPercentage);
  }

  completionLabel(): string {
    const step = this.nearestCompletionStep(this.dragValue());
    return COMPLETION_LABELS[step] ?? `${step}%`;
  }

  canSubmit(): boolean {
    if (!this.feedback.started) return this.feedback.notStartedReason !== null;
    return (this.feedback.positiveAspects.length > 0 || this.feedback.negativeAspects.length > 0) && this.feedback.selectionFitRating !== null && this.feedback.outcomeAttribution !== null;
  }

  private nearestCompletionStep(value: number): number {
    return COMPLETION_STEPS.reduce((best, step) => (Math.abs(step - value) < Math.abs(best - value) ? step : best), COMPLETION_STEPS[0]);
  }

  toggleAspect(kind: 'positiveAspects' | 'negativeAspects', key: string): void {
    const values = this.feedback[kind];
    this.feedback[kind] = values.includes(key) ? values.filter((item) => item !== key) : [...values, key].slice(0, 3);
  }

  aspectDisabled(kind: 'positiveAspects' | 'negativeAspects', key: string): boolean {
    const values = this.feedback[kind];
    return values.length >= 3 && !values.includes(key);
  }

  async submit(): Promise<void> {
    this.submitting.set(true);
    try {
      await this.api.submitFeedbackByToken(this.token, { ...this.feedback, idempotencyKey: crypto.randomUUID() });
      this.toast.success('Feedback guardado. Gracias por contarnos.');
      this.received.set(true);
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No pudimos guardar tu feedback.');
    } finally {
      this.submitting.set(false);
    }
  }
}
