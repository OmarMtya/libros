import { Component, HostListener, inject } from '@angular/core';
import { DialogService } from '../dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    @if (dialog.confirmState(); as state) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <button type="button" class="absolute inset-0 bg-ink/50" (click)="dialog.close(false)" aria-label="Cancelar"></button>
        <div class="relative w-full max-w-md rounded-sm border border-[#cad7df] bg-white p-6 shadow-[0_10px_40px_rgba(20,44,62,0.25)] animate-[toast-in_150ms_ease-out]">
          <h2 id="confirm-dialog-title" class="mb-2 font-display text-2xl font-bold tracking-[-0.03em] text-ink">{{ state.title }}</h2>
          <p id="confirm-dialog-message" class="mb-6 text-sm leading-relaxed text-[#536875]">{{ state.message }}</p>
          <div class="flex justify-end gap-2">
            <button type="button" class="rounded-sm border border-[#7d9ab0] px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#e6eef3]" (click)="dialog.close(false)">{{ state.cancelLabel }}</button>
            <button
              type="button"
              class="rounded-sm px-4 py-2 text-sm font-bold text-white transition"
              [class.bg-coral]="state.danger"
              [class.hover:bg-coral-deep]="state.danger"
              [class.bg-ink]="!state.danger"
              [class.hover:bg-ink-soft]="!state.danger"
              (click)="dialog.close(true)">{{ state.confirmLabel }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  readonly dialog = inject(DialogService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.dialog.close(false);
  }
}
