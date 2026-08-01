import { Component, inject } from '@angular/core';
import { ToastService } from '../toast.service';

@Component({
  selector: 'app-toast-host',
  template: `
    <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" role="status" aria-live="polite">
      @for (toast of toasts(); track toast.id) {
        <div
          class="pointer-events-auto w-full max-w-md rounded-sm border-l-[3px] px-4 py-3 text-sm shadow-[0_6px_24px_rgba(20,44,62,0.16)] animate-[toast-in_180ms_ease-out]"
          [class.border-coral]="toast.kind === 'error'"
          [class.bg-[#fbe9e6]]="toast.kind === 'error'"
          [class.text-[#7a2c1f]]="toast.kind === 'error'"
          [class.border-[#2e7656]]="toast.kind === 'success'"
          [class.bg-[#e2f0e9]]="toast.kind === 'success'"
          [class.text-[#16442f]]="toast.kind === 'success'"
          [class.border-[#567088]]="toast.kind === 'info'"
          [class.bg-[#eef3f6]]="toast.kind === 'info'"
          [class.text-ink]="toast.kind === 'info'">
          <div class="flex items-start gap-3">
            <p class="min-w-0 flex-1 leading-relaxed">{{ toast.message }}</p>
            <button
              type="button"
              class="shrink-0 font-mono text-xs font-bold opacity-50 transition hover:opacity-100"
              (click)="dismiss(toast.id)"
              aria-label="Cerrar aviso">✕</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  private readonly toastService = inject(ToastService);
  readonly toasts = this.toastService.toasts;

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}
