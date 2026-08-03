import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { SessionStore } from '../session-store';
import { ToastService } from '../toast.service';

const LOGIN_MEDIA = {
  side: 'https://images.pexels.com/photos/4865725/pexels-photo-4865725.jpeg?auto=compress&cs=tinysrgb&w=1400',
  cozy: 'https://images.pexels.com/photos/6958652/pexels-photo-6958652.jpeg?auto=compress&cs=tinysrgb&w=1200',
};

const TRUST_LINE = ['Libro físico', 'Pago único', 'Sin suscripción', 'Envío incluido'];

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="relative min-h-screen overflow-hidden bg-ink text-white">
      <img
        [src]="LOGIN_MEDIA.side"
        alt=""
        aria-hidden="true"
        class="absolute inset-0 h-full w-full object-cover opacity-25">
      <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-br from-ink via-ink/85 to-ink"></div>
      <div aria-hidden="true" class="pointer-events-none absolute -left-24 bottom-[-18%] h-96 w-96 rounded-full bg-coral/15 blur-3xl"></div>
      <div aria-hidden="true" class="pointer-events-none absolute right-[6%] top-[-34%] h-[70%] w-24 rotate-[28deg] bg-marker/40"></div>

      <div class="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:gap-16">
        <section class="max-w-xl lg:flex-1">
          <a routerLink="/" class="inline-flex items-center gap-2 font-display text-2xl font-extrabold tracking-[-0.03em] text-white no-underline">
            Mi libro <span class="bg-coral px-1 py-0.5 text-white">Sorpresa</span>
          </a>

          <p class="mb-5 mt-10 font-mono text-xs uppercase tracking-[0.12em] text-marker">Tu próxima historia empieza aquí</p>
          <h1 class="mb-5 max-w-[13ch] font-display text-4xl font-bold leading-[0.95] tracking-[-0.055em] sm:text-5xl lg:text-6xl">
            Volver a encontrarte con tus lecturas.
          </h1>
          <p class="mb-8 max-w-[46ch] text-base leading-relaxed text-[#c6d3de] sm:text-lg">
            Inicia sesión para continuar tu perfil lector o crea tu cuenta y empecemos a elegir una sorpresa
            pensada para ti.
          </p>

          <ul class="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.08em] text-mist/90">
            @for (item of TRUST_LINE; track item) {
              <li class="flex items-center gap-2">
                <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-marker"></span>
                {{ item }}
              </li>
            }
          </ul>
        </section>

        <section class="w-full max-w-md lg:max-w-sm xl:max-w-md">
          <div class="rounded-sm border border-white/10 bg-white p-6 text-graphite shadow-[0_24px_60px_rgba(8,20,30,0.45)] sm:p-8">
            <div class="mb-7 grid grid-cols-2 gap-1 rounded-sm border border-[#d8e1e8] bg-[#eef3f6] p-1" role="tablist" aria-label="Acceso">
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="mode() === 'login'"
                class="rounded-sm py-2 text-sm font-bold transition active:scale-[0.97]"
                [class.bg-ink]="mode() === 'login'"
                [class.text-white]="mode() === 'login'"
                [class.text-[#567088]]="mode() !== 'login'"
                (click)="switchMode('login')">
                Iniciar sesión
              </button>
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="mode() === 'register'"
                class="rounded-sm py-2 text-sm font-bold transition active:scale-[0.97]"
                [class.bg-ink]="mode() === 'register'"
                [class.text-white]="mode() === 'register'"
                [class.text-[#567088]]="mode() !== 'register'"
                (click)="switchMode('register')">
                Crear cuenta
              </button>
            </div>

            <div #authPanel>
            <h2 class="font-display text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">
              {{ mode() === 'login' ? 'Bienvenido de vuelta' : 'Crea tu perfil lector' }}
            </h2>
            <p class="mb-6 mt-2 text-sm leading-relaxed text-[#536875]">
              {{ mode() === 'login'
                ? 'Entra para continuar armando tu próxima sorpresa.'
                : 'Cuéntanos cómo lees y empecemos a elegir un libro con intención.' }}
            </p>

            <form class="space-y-4" (ngSubmit)="submit()">
              @if (mode() === 'register') {
                <label class="block">
                  <span class="mb-1.5 block text-sm font-semibold text-ink">Tu nombre</span>
                  <input
                    [(ngModel)]="name"
                    name="name"
                    type="text"
                    autocomplete="name"
                    placeholder="Cómo quieres que te llamemos"
                    class="w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2.5 text-ink placeholder:text-[#8fa8bc] focus:border-ink">
                </label>
              }
              <label class="block">
                <span class="mb-1.5 block text-sm font-semibold text-ink">Correo electrónico</span>
                <input
                  [(ngModel)]="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  placeholder="tucorreo@ejemplo.com"
                  class="w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2.5 text-ink placeholder:text-[#8fa8bc] focus:border-ink">
              </label>
              <label class="block">
                <span class="mb-1.5 block text-sm font-semibold text-ink">Contraseña</span>
                <div class="relative">
                  <input
                    [(ngModel)]="password"
                    name="password"
                    [type]="showPassword() ? 'text' : 'password'"
                    [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
                    placeholder="Mínimo 6 caracteres"
                    class="w-full rounded-sm border border-[#9eb2c1] bg-white px-3 py-2.5 pr-11 text-ink placeholder:text-[#8fa8bc] focus:border-ink">
                  <button
                    type="button"
                    class="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#7d9ab0] transition hover:text-ink active:scale-90"
                    [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                    [attr.aria-pressed]="showPassword()"
                    (click)="showPassword.set(!showPassword())">
                    @if (showPassword()) {
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
                    } @else {
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                    }
                  </button>
                </div>
              </label>

              @if (error()) {
                <p class="rounded-sm border-l-[3px] border-coral bg-[#fbe9e6] px-3 py-2 text-sm text-[#7a2c1f]" role="alert">
                  {{ error() }}
                </p>
              }
              @if (info()) {
                <p class="rounded-sm border-l-[3px] border-marker bg-[#fff7e6] px-3 py-2 text-sm text-[#6b5310]" role="status">
                  {{ info() }}
                </p>
              }

              @if (mode() === 'register') {
                <label class="flex items-start gap-2.5 text-sm leading-relaxed text-[#536875]">
                  <input
                    type="checkbox"
                    name="acceptedTerms"
                    [(ngModel)]="acceptedTerms"
                    class="mt-0.5 h-4 w-4 shrink-0 accent-coral-deep">
                  <span>
                    He leído y acepto los
                    <a routerLink="/terminos-y-condiciones" class="font-semibold text-ink underline underline-offset-2 hover:text-coral">Términos y Condiciones</a>
                    y el
                    <a routerLink="/aviso-de-privacidad" class="font-semibold text-ink underline underline-offset-2 hover:text-coral">Aviso de Privacidad</a>.
                  </span>
                </label>
              }

              @if (!auth.configured) {
                <p class="rounded-sm border-l-[3px] border-marker bg-[#fff7e6] px-3 py-2 text-sm text-[#6b5310]">
                  El acceso se habilitará al conectar el proyecto de Supabase.
                </p>
              }

              <button
                type="submit"
                [disabled]="busy()"
                class="w-full rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep active:scale-[0.97] disabled:cursor-wait disabled:opacity-60">
                {{ busy() ? 'Un momento…' : (mode() === 'login' ? 'Iniciar sesión' : 'Crear mi cuenta') }}
              </button>
            </form>

            </div>

            <div class="my-5 flex items-center gap-3" aria-hidden="true">
              <span class="h-px flex-1 bg-[#d8e1e8]"></span>
              <span class="font-mono text-[11px] uppercase tracking-[0.08em] text-[#7d9ab0]">o</span>
              <span class="h-px flex-1 bg-[#d8e1e8]"></span>
            </div>

            <button
              type="button"
              class="flex w-full items-center justify-center gap-3 rounded-sm border border-[#9eb2c1] bg-white px-6 py-3 text-sm font-bold text-ink transition hover:bg-[#eef3f6] active:scale-[0.97] disabled:cursor-wait disabled:opacity-60"
              (click)="google()"
              [disabled]="busy()">
              <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
              </svg>
              Continuar con Google
            </button>

            <p class="mt-5 text-center text-sm text-[#567088]">
              {{ mode() === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes una cuenta?' }}
              <button
                type="button"
                class="font-semibold text-ink underline underline-offset-2 hover:text-coral"
                (click)="switchMode(mode() === 'login' ? 'register' : 'login')">
                {{ mode() === 'login' ? 'Crear cuenta' : 'Iniciar sesión' }}
              </button>
            </p>
          </div>

          <p class="mt-5 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-mist/80">
            Mi libro Sorpresa — Elegimos historias pensando en quien las va a leer.
          </p>
        </section>
      </div>
    </div>
  `,
})
export class Login {
  readonly store = inject(SessionStore);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly LOGIN_MEDIA = LOGIN_MEDIA;
  readonly TRUST_LINE = TRUST_LINE;

  readonly mode = signal<'login' | 'register'>('login');
  readonly busy = signal(false);
  readonly showPassword = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);

  readonly authPanel = viewChild<ElementRef<HTMLDivElement>>('authPanel');
  private firstSwitch = true;

  constructor() {
    effect(() => {
      this.mode();
      if (this.firstSwitch) {
        this.firstSwitch = false;
        return;
      }
      const el = this.authPanel()?.nativeElement;
      if (!el) return;
      el.classList.remove('rise-in');
      void el.getBoundingClientRect();
      el.classList.add('rise-in');
    });
  }

  name = '';
  email = '';
  password = '';
  acceptedTerms = false;

  switchMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
    this.error.set(null);
    this.info.set(null);
    this.acceptedTerms = false;
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    const email = this.email.trim();
    const password = this.password;
    if (!email || !password) {
      this.error.set('Completa tu correo y tu contraseña.');
      return;
    }
    if (this.mode() === 'register') {
      if (!this.name.trim()) {
        this.error.set('Cuéntanos tu nombre para personalizar tu experiencia.');
        return;
      }
      if (password.length < 6) {
        this.error.set('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (!this.acceptedTerms) {
        this.error.set('Para crear tu cuenta, acepta los Términos y Condiciones y el Aviso de Privacidad.');
        return;
      }
    }

    this.busy.set(true);
    this.error.set(null);
    this.info.set(null);
    try {
      if (this.mode() === 'login') {
        await this.store.signInWithEmail(email, password);
        this.toast.success('Hola de nuevo. Retomemos tu perfil lector.');
        await this.router.navigate(['/app']);
      } else {
        const result = await this.store.signUpWithEmail(email, password, this.name.trim());
        if (result.needsConfirmation) {
          this.switchMode('login');
          this.info.set('Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada y vuelve a iniciar sesión.');
        } else {
          this.toast.success('Tu perfil lector está listo.');
          await this.router.navigate(['/app']);
        }
      }
    } catch (err) {
      this.error.set(this.translateError(err));
    } finally {
      this.busy.set(false);
    }
  }

  async google(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.store.signIn();
    } catch (err) {
      this.busy.set(false);
      this.error.set(this.translateError(err));
    }
  }

  private translateError(err: unknown): string {
    if (!(err instanceof Error)) return 'No pudimos completar la acción. Intenta de nuevo.';
    const message = err.message;
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials')) return 'El correo o la contraseña no son correctos.';
    if (lower.includes('user already registered')) return 'Ya existe una cuenta con este correo. Intenta iniciar sesión.';
    if (lower.includes('email not confirmed')) return 'Confirma tu correo electrónico antes de iniciar sesión.';
    if (lower.includes('password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (lower.includes('rate limit') || lower.includes('too many requests')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
    if (lower.includes('supabase')) return message;
    return message;
  }
}
