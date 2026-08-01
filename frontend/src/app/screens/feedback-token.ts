import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../api.service';
import { ToastService } from '../toast.service';

type FeedbackStatus = 'completed' | 'in_progress' | 'paused' | 'abandoned' | 'not_started';

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

@Component({
  selector: 'app-feedback-token',
  imports: [FormsModule],
  template: `
    <div class="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      @if (received()) {
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
        <p class="mb-8 text-[#536875]">
          @for (author of book()!.authors; track author) { {{ author }}{{ $last ? '' : ', ' }} }
          @if (book()!.contributors.length > 0) {
            · Trad. @for (contributor of book()!.contributors; track contributor) { {{ contributor }}{{ $last ? '' : ', ' }} }
          }
        </p>

        <section class="space-y-6 rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
          <div class="flex flex-wrap gap-3">
            <button type="button" class="rounded-sm border px-4 py-2 text-sm font-bold transition" [class.bg-ink]="feedback.started" [class.text-white]="feedback.started" [class.border-ink]="feedback.started" [class.bg-white]="!feedback.started" [class.text-ink]="!feedback.started" [class.border-[#7d9ab0]]="!feedback.started" (click)="setStarted(true)">Sí lo empecé</button>
            <button type="button" class="rounded-sm border px-4 py-2 text-sm font-bold transition" [class.bg-ink]="!feedback.started" [class.text-white]="!feedback.started" [class.border-ink]="!feedback.started" [class.bg-white]="feedback.started" [class.text-ink]="feedback.started" [class.border-[#7d9ab0]]="feedback.started" (click)="setStarted(false)">No lo empecé</button>
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
              <span class="text-sm font-semibold text-ink">Lo que funcionó</span>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (item of positiveAspects; track item.key) {
                  <button type="button" class="rounded-full border px-3 py-1.5 text-sm transition" [class.bg-ink]="feedback.positiveAspects.includes(item.key)" [class.text-white]="feedback.positiveAspects.includes(item.key)" [class.border-ink]="feedback.positiveAspects.includes(item.key)" [class.bg-white]="!feedback.positiveAspects.includes(item.key)" [class.text-ink]="!feedback.positiveAspects.includes(item.key)" [class.border-[#7d9ab0]]="!feedback.positiveAspects.includes(item.key)" (click)="toggleAspect('positiveAspects', item.key)">{{ item.label }}</button>
                }
              </div>
            </div>

            <div>
              <span class="text-sm font-semibold text-ink">Lo que no funcionó</span>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (item of negativeAspects; track item.key) {
                  <button type="button" class="rounded-full border px-3 py-1.5 text-sm transition" [class.bg-coral]="feedback.negativeAspects.includes(item.key)" [class.text-white]="feedback.negativeAspects.includes(item.key)" [class.border-coral]="feedback.negativeAspects.includes(item.key)" [class.bg-white]="!feedback.negativeAspects.includes(item.key)" [class.text-ink]="!feedback.negativeAspects.includes(item.key)" [class.border-[#7d9ab0]]="!feedback.negativeAspects.includes(item.key)" (click)="toggleAspect('negativeAspects', item.key)">{{ item.label }}</button>
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
            <textarea [(ngModel)]="feedback.freeText" rows="4" class="mt-1 w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2" placeholder="Cuéntanos cualquier detalle…"></textarea>
          </label>

          <button type="button" class="rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep disabled:cursor-wait disabled:opacity-60" (click)="submit()" [disabled]="submitting()">Enviar feedback</button>
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

  feedback = {
    started: true,
    notStartedReason: 'no_time',
    readingStatus: 'completed' as FeedbackStatus,
    completionPercentage: 100,
    positiveAspects: [] as string[],
    negativeAspects: [] as string[],
    outcomeAttribution: 'mostly_book',
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
      if (result.received) {
        this.received.set(true);
      } else {
        this.book.set(result.book);
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'La invitación no es válida.');
    } finally {
      this.loading.set(false);
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
