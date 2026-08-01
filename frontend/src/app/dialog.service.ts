import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (value: boolean) => void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly confirmState = signal<ConfirmDialogState | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.confirmState.set({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        danger: options.danger ?? false,
        resolve,
      });
    });
  }

  close(result: boolean): void {
    const state = this.confirmState();
    this.confirmState.set(null);
    state?.resolve(result);
  }
}
