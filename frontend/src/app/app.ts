import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Header } from './components/header';
import { ToastHost } from './components/toast';
import { ConfirmDialog } from './components/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, ToastHost, ConfirmDialog],
  template: `
    <a class="fixed -top-16 left-4 z-10 bg-marker px-4 py-2.5 font-semibold text-ink focus:top-4" href="#contenido">Saltar al contenido</a>
    @if (showHeader()) {
      <app-header></app-header>
    }
    <main id="contenido">
      <router-outlet />
    </main>
    <app-toast-host></app-toast-host>
    <app-confirm-dialog></app-confirm-dialog>
  `,
})
export class App {
  private readonly router = inject(Router);
  readonly showHeader = signal(true);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const path = event.urlAfterRedirects.split('?')[0].split('#')[0];
        this.showHeader.set(path !== '/' && path !== '/app/login');
      }
    });
  }
}
