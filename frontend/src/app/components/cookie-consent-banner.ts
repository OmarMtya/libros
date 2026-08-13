import { Component, inject } from '@angular/core';
import { CookieConsentService } from '../cookie-consent.service';

@Component({
  selector: 'app-cookie-consent-banner',
  imports: [],
  template: `
    @if (consent.consent() === 'undecided') {
      <div
        role="dialog"
        aria-modal="false"
        aria-label="Aviso de cookies y privacidad"
        class="fixed inset-x-0 bottom-0 z-40 border-t border-[#2b4a63] bg-ink px-4 py-4 text-white shadow-[0_-8px_30px_rgba(19,42,58,0.35)] sm:px-6">
        <div class="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div class="max-w-3xl">
            <p class="font-display text-base font-bold tracking-[-0.02em]">Tu privacidad importa</p>
            <p class="mt-1 text-sm leading-relaxed text-[#c6d3de]">
              Usamos almacenamiento en tu navegador para recordar tu sesión, tus preferencias y el
              avance de tu perfil lector (necesario para el servicio). Con tu consentimiento, también
              cargamos herramientas de medición de terceros. Puedes aceptarlas, rechazarlas o leer nuestro
              <a [href]="privacyUrl" target="_blank" rel="noopener" class="font-semibold text-white underline decoration-marker decoration-2 underline-offset-2 transition hover:text-marker">
                Aviso de privacidad
              </a>.
            </p>
          </div>
          <div class="flex shrink-0 flex-col gap-2 sm:flex-row">
            <button
              type="button"
              class="rounded-sm border border-[#5b7a94] px-4 py-2 text-sm font-bold text-[#c6d3de] transition hover:bg-[#2b4a63] hover:text-white"
              (click)="rejectAndLeave()">Rechazar y salir</button>
            <button
              type="button"
              class="rounded-sm bg-coral px-5 py-2 text-sm font-bold text-white transition hover:bg-coral-deep active:scale-[0.97]"
              (click)="consent.accept()">Aceptar</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CookieConsentBanner {
  readonly consent = inject(CookieConsentService);
  readonly privacyUrl = `${window.location.origin}/aviso-de-privacidad`;

  rejectAndLeave(): void {
    window.location.href = 'https://google.com';
  }
}
