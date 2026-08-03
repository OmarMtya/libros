import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AppShell } from './components/app-shell';
import { ToastHost } from './components/toast';
import { ConfirmDialog } from './components/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppShell, ToastHost, ConfirmDialog],
  template: `
    <a class="fixed -top-16 left-4 z-10 bg-marker px-4 py-2.5 font-semibold text-ink focus:top-4" href="#contenido">Saltar al contenido</a>
    @if (showShell()) {
      <app-shell><router-outlet /></app-shell>
    } @else {
      <router-outlet />
    }
    <app-toast-host></app-toast-host>
    <app-confirm-dialog></app-confirm-dialog>
  `,
})
export class App {
  private readonly router = inject(Router);
  readonly showShell = signal(inShell(window.location.pathname));

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const path = event.urlAfterRedirects.split('?')[0].split('#')[0];
        this.showShell.set(inShell(path));
      }
    });
  }
}

function inShell(path: string): boolean {
  return path.startsWith('/app') && path !== '/app/login';
}
