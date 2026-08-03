import { Component } from '@angular/core';
import { LegalShell } from './legal-doc';

const CONTACT = {
  email: 'hola@milibrosorpresa.com',
  whatsapp: '+52 653 128 6373',
  whatsappLink: 'https://wa.me/526531286373',
};

const TOPICS = [
  'Pedidos, envíos y entregas.',
  'Pagos, reembolsos y cancelaciones.',
  'Privacidad y ejercicio de derechos ARCO.',
  'Eliminación de cuenta y datos.',
  'Cualquier otra duda sobre el servicio.',
];

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [LegalShell],
  template: `
    <app-legal-shell>
      <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Contacto</p>
      <h1 class="mb-3 font-display text-4xl font-bold leading-[1.02] tracking-[-0.04em] text-ink sm:text-5xl">
        Estamos aquí para ayudarte.
      </h1>
      <p class="mb-10 max-w-2xl text-[15px] leading-relaxed text-[#536875]">
        Escríbenos por correo electrónico o por WhatsApp. Responderemos en un plazo razonable, normalmente en unos días hábiles.
      </p>

      <section class="mb-10 grid gap-5 sm:grid-cols-2">
        <a
          [href]="'mailto:' + CONTACT.email"
          class="group rounded-sm border border-[#cad7df] bg-white p-7 no-underline transition hover:border-coral-deep">
          <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Correo electrónico</p>
          <p class="font-display text-lg font-bold tracking-[-0.02em] text-ink group-hover:text-coral-deep">
            {{ CONTACT.email }}
          </p>
          <p class="mt-2 text-sm text-[#536875]">Para solicitudes formales, privacidad, derechos ARCO y documentación, escribe aquí.</p>
        </a>

        <a
          [href]="CONTACT.whatsappLink"
          target="_blank"
          rel="noopener noreferrer"
          class="group rounded-sm border border-[#cad7df] bg-white p-7 no-underline transition hover:border-coral-deep">
          <p class="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">WhatsApp</p>
          <p class="font-display text-lg font-bold tracking-[-0.02em] text-ink group-hover:text-coral-deep">
            {{ CONTACT.whatsapp }}
          </p>
          <p class="mt-2 text-sm text-[#536875]">Para dudas rápidas sobre tu pedido, tu envío o la experiencia, mándanos un mensaje.</p>
        </a>
      </section>

      <section class="mb-10 rounded-sm border border-[#cad7df] bg-white p-7 sm:p-8">
        <h2 class="mb-4 font-display text-2xl font-bold tracking-[-0.02em] text-ink">¿Sobre qué podemos ayudarte?</h2>
        <ul class="space-y-2">
          @for (topic of TOPICS; track topic) {
            <li class="flex items-start gap-2.5 text-[15px] leading-relaxed text-[#536875]">
              <span aria-hidden="true" class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-coral"></span>
              <span>{{ topic }}</span>
            </li>
          }
        </ul>
      </section>
    </app-legal-shell>
  `,
})
export class Contacto {
  readonly CONTACT = CONTACT;
  readonly TOPICS = TOPICS;
}
