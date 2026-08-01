import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);

  private nextId = 1;

  success(message: string, duration = 4000): void {
    this.show('success', message, duration);
  }

  error(message: string, duration = 7000): void {
    this.show('error', message, duration);
  }

  info(message: string, duration = 5000): void {
    this.show('info', message, duration);
  }

  dismiss(id: number): void {
    this.toasts.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, message: string, duration: number): void {
    const id = this.nextId++;
    this.toasts.update((toasts) => [...toasts, { id, kind, message }]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }
}
