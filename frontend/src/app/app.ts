import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AppShell } from './components/app-shell';
import { ToastHost } from './components/toast';
import { ConfirmDialog } from './components/confirm-dialog';
import { CookieConsentBanner } from './components/cookie-consent-banner';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppShell, ToastHost, ConfirmDialog, CookieConsentBanner],
  template: `
    <a class="fixed -top-16 left-4 z-10 bg-marker px-4 py-2.5 font-semibold text-ink focus:top-4" href="#contenido">Saltar al contenido</a>
    @if (showShell()) {
      <app-shell><router-outlet /></app-shell>
    } @else {
      <router-outlet />
    }
    <app-toast-host></app-toast-host>
    <app-confirm-dialog></app-confirm-dialog>
    <app-cookie-consent-banner></app-cookie-consent-banner>
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly showShell = signal(inShell(window.location.pathname, false));

  constructor() {
    void this.auth.whenReady().then(() => this.apply());
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.apply();
    });
  }

  private apply(): void {
    this.showShell.set(inShell(window.location.pathname, this.auth.userId != null));
  }
}

function inShell(path: string, loggedIn: boolean): boolean {
  if (!path.startsWith('/app') || path === '/app/login' || path === '/app/restablecer-contrasena') return false;
  if (path.startsWith('/app/perfil/')) return loggedIn;
  return true;
}
