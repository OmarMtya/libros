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
  inputs: DialogInput[];
  resolve: (value: boolean | string | Record<string, string> | null) => void;
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

export interface PromptManyOptions extends ConfirmOptions {
  inputs: DialogInput[];
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
        inputs: [],
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
        inputs: [
          {
            label: options.inputLabel,
            placeholder: options.placeholder ?? '',
            initialValue: options.initialValue ?? '',
          },
        ],
        resolve: (value) => resolve(typeof value === 'object' && value !== null ? (value[options.inputLabel] ?? null) : null),
      });
    });
  }

  promptMany(options: PromptManyOptions): Promise<Record<string, string> | null> {
    return new Promise<Record<string, string> | null>((resolve) => {
      this.confirmState.set({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Confirmar',
        cancelLabel: options.cancelLabel ?? 'Cancelar',
        danger: options.danger ?? false,
        inputs: options.inputs,
        resolve: (value) => resolve(typeof value === 'object' && value !== null ? value : null),
      });
    });
  }

  close(result: boolean | string | Record<string, string> | null): void {
    const state = this.confirmState();
    this.confirmState.set(null);
    state?.resolve(result);
  }

  cancel(): void {
    const state = this.confirmState();
    if (!state) return;
    this.confirmState.set(null);
    state.resolve(state.inputs.length > 0 ? null : false);
  }
}
