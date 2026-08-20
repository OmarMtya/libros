import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-ink px-4 py-12 text-white sm:px-6">
      <main class="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md items-center justify-center">
        <section class="w-full rounded-sm border border-white/10 bg-white p-6 text-graphite shadow-[0_24px_60px_rgba(8,20,30,0.45)] sm:p-8">
          <a routerLink="/" class="font-display text-2xl font-extrabold tracking-[-0.03em] text-ink no-underline">
            Mi libro <span class="bg-coral px-1 py-0.5 text-white">Sorpresa</span>
          </a>

          <h1 class="mt-10 font-display text-3xl font-bold tracking-[-0.03em] text-ink">Crea una contraseña nueva</h1>
          <p class="mb-6 mt-2 text-sm leading-relaxed text-[#536875]">
            Elige una contraseña de al menos 6 caracteres para volver a entrar a tu perfil lector.
          </p>

          @if (error()) {
            <p class="mb-4 rounded-sm border-l-[3px] border-coral bg-[#fbe9e6] px-3 py-2 text-sm text-[#7a2c1f]" role="alert">
              {{ error() }}
            </p>
          }
          @if (success()) {
            <p class="mb-4 rounded-sm border-l-[3px] border-marker bg-[#fff7e6] px-3 py-2 text-sm text-[#6b5310]" role="status">
              {{ success() }}
            </p>
          }

          @if (ready() && auth.session() && !success()) {
            <form class="space-y-4" (ngSubmit)="submit()">
              <label class="block">
                <span class="mb-1.5 block text-sm font-semibold text-ink">Nueva contraseña</span>
                <input [(ngModel)]="password" name="password" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" class="w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2.5 text-ink placeholder:text-[#8fa8bc] focus:border-ink">
              </label>
              <label class="block">
                <span class="mb-1.5 block text-sm font-semibold text-ink">Repite la contraseña</span>
                <input [(ngModel)]="confirmation" name="confirmation" type="password" autocomplete="new-password" placeholder="Escribe la contraseña otra vez" class="w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2.5 text-ink placeholder:text-[#8fa8bc] focus:border-ink">
              </label>
              <button type="submit" [disabled]="busy()" class="w-full rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep active:scale-[0.97] disabled:cursor-wait disabled:opacity-60">
                {{ busy() ? 'Guardando…' : 'Guardar contraseña' }}
              </button>
            </form>
          } @else if (ready() && !auth.session() && !success()) {
            <a routerLink="/app/login" class="block w-full rounded-sm bg-coral px-6 py-3 text-center text-sm font-bold text-white no-underline transition hover:bg-coral-deep">
              Solicitar otro enlace
            </a>
          }

          @if (success()) {
            <a routerLink="/app/login" class="block w-full rounded-sm bg-coral px-6 py-3 text-center text-sm font-bold text-white no-underline transition hover:bg-coral-deep">
              Iniciar sesión
            </a>
          }
        </section>
      </main>
    </div>
  `,
})
export class ResetPassword {
  readonly auth = inject(AuthService);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  password = '';
  confirmation = '';

  constructor() {
    void this.auth.whenReady().then(() => {
      this.ready.set(true);
      if (!this.auth.session()) {
        this.error.set('Este enlace no es válido o ya venció. Solicita uno nuevo para continuar.');
      }
    });
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    if (this.password.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.password !== this.confirmation) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.updatePassword(this.password);
      await this.auth.signOut();
      this.success.set('Tu contraseña se actualizó. Ya puedes iniciar sesión con ella.');
    } catch (err) {
      this.error.set(this.translateError(err));
    } finally {
      this.busy.set(false);
    }
  }

  private translateError(err: unknown): string {
    if (!(err instanceof Error)) return 'No pudimos actualizar tu contraseña. Solicita otro enlace e inténtalo de nuevo.';
    const lower = err.message.toLowerCase();
    if (lower.includes('same password') || lower.includes('different from the old password')) return 'La nueva contraseña debe ser diferente a la anterior.';
    if (lower.includes('expired') || lower.includes('invalid')) return 'Este enlace no es válido o ya venció. Solicita uno nuevo.';
    if (lower.includes('rate limit') || lower.includes('too many requests')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    return err.message;
  }
}
