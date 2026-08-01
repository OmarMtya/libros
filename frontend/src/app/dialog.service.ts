import { Injectable, signal } from '@angular/core';

export interface DialogInput {
  label: string;
  placeholder: string;
  initialValue: string;
}

export interface DialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  input: DialogInput | null;
  resolve: (value: boolean | string | null) => void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PromptOptions extends ConfirmOptions {
  inputLabel: string;
  placeholder?: string;
  initialValue?: string;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly confirmState = signal<DialogState | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.confirmState.set({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        danger: options.danger ?? false,
        input: null,
        resolve: (value) => resolve(value === true),
      });
    });
  }

  prompt(options: PromptOptions): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      this.confirmState.set({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        danger: options.danger ?? false,
        input: {
          label: options.inputLabel,
          placeholder: options.placeholder ?? '',
          initialValue: options.initialValue ?? '',
        },
        resolve: (value: boolean | string | null) => resolve(typeof value === 'string' ? value : null),
      });
    });
  }

  close(result: boolean | string | null): void {
    const state = this.confirmState();
    this.confirmState.set(null);
    state?.resolve(result);
  }

  cancel(): void {
    const state = this.confirmState();
    if (!state) return;
    this.confirmState.set(null);
    state.resolve(state.input ? null : false);
  }
}
