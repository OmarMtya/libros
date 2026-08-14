import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService, orderFeedbackDone, orderIsActive, ProductPackage, UserOrder } from '../api.service';
import { AuthService } from '../auth.service';
import { trackMetaEvent } from '../meta-pixel';
import { OrderTimeline } from '../components/order-timeline';
import { environment } from '../../environments/environment';

const PAYMENT_LINK = environment.paymentLink;

const PACKAGE_MEDIA = {
  label: 'Libro físico',
  imageUrl: 'https://images.pexels.com/photos/6958652/pexels-photo-6958652.jpeg?auto=compress&cs=tinysrgb&w=800',
};

const BOX_CONTENTS = [
  { title: 'El libro', detail: 'Un título físico, elegido con tu perfil lector.' },
  { title: 'Carta personalizada', detail: 'Te contamos, por escrito, por qué elegimos tu libro.' },
  { title: 'Separador de libros', detail: 'Para que tu sorpresa no se pierda entre páginas.' },
  { title: 'QR de aprendizaje', detail: 'Escanéalo y cuéntanos qué te pareció; así afinamos la siguiente sorpresa.' },
];

@Component({
  selector: 'app-experience',
  imports: [CurrencyPipe, OrderTimeline],
  template: `
    <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <p class="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Tu siguiente capítulo</p>
      <h1 class="mb-3 max-w-[12ch] font-display text-5xl font-bold leading-[0.94] tracking-[-0.05em] text-ink sm:text-6xl">
        Una caja.<br>Un libro.<br>Elegido para ti.
      </h1>
      <p class="mb-10 max-w-xl text-[#536875]">
        Armamos tu sorpresa a partir de lo que aprendemos de ti.
      </p>

      @if (!package()) {
        <section class="rounded-sm border border-[#cad7df] bg-white p-10 text-center">
          <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Preparando tu sorpresa…</p>
        </section>
      } @else if (package(); as pkg) {
        <section class="grid gap-6 lg:grid-cols-5">
          <figure class="relative overflow-hidden rounded-sm lg:col-span-3">
            <img
              [src]="PACKAGE_MEDIA.imageUrl"
              [alt]="PACKAGE_MEDIA.label"
              class="aspect-[4/3] w-full object-cover">
            <span
              aria-hidden="true"
              class="pointer-events-none absolute left-4 top-4 bg-coral px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-white shadow-[0_2px_6px_rgba(19,42,58,0.25)]">
              Precio fundador
            </span>
          </figure>

          <aside class="flex flex-col gap-4 rounded-sm border border-[#cad7df] bg-white p-6 lg:col-span-2">
            @if (blocked()) {
              <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Paquete sorpresa</p>
              <h2 class="font-display text-3xl font-bold tracking-[-0.03em] text-ink">{{ activeOrder()!.packageName }}</h2>
              <app-order-timeline [status]="activeOrder()!.fulfillment?.status ?? ''" [compact]="true" />
              @if (delivered()) {
                <p class="rounded-sm border-l-[3px] border-[#f0e0b0] bg-[#fff7e6] px-3 py-2 text-sm text-[#6b5310]">
                  Para volver a pedir y seguir afinando tus recomendaciones, completa el cuestionario que viene en el
                  <strong>código QR</strong> dentro de tu paquete. También lo encontrarás en tu correo electrónico.
                </p>
              } @else {
                <p class="text-sm leading-relaxed text-[#536875]">
                  Tu envío está en proceso. Los envíos tardan de 5 a 10 días hábiles y nos comunicaremos
                  contigo en cada paso de tu pedido.
                </p>
              }
              <button
                class="mt-auto w-full rounded-sm bg-ink px-6 py-3 text-sm font-bold text-white transition hover:bg-ink-soft"
                type="button"
                (click)="goToOrder()">
                Seguir mi pedido
              </button>
            } @else {
              <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Paquete sorpresa</p>
              <h2 class="font-display text-3xl font-bold tracking-[-0.03em] text-ink">{{ pkg.name }}</h2>
              <p class="text-sm leading-relaxed text-[#536875]">{{ pkg.description }}</p>

              <div class="mt-auto flex flex-col gap-4">
                <p class="font-mono text-2xl font-bold text-ink">
                  {{ (pkg.priceCents + pkg.shippingCents) / 100 | currency:'MXN':'$':'1.0-0' }} MXN
                  <span class="ml-1 text-sm font-normal text-[#567088]">incluye envío</span>
                </p>
                <p class="rounded-sm bg-[#fff0e6] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.1em] text-coral-deep">
                  Oferta de lanzamiento
                </p>
                <p class="text-xs leading-relaxed text-[#536875]">
                  Envíos de 5 a 10 días hábiles. Nos comunicaremos contigo en cada paso de tu pedido.
                </p>
                <p class="rounded-sm bg-[#eef4f7] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-[#3e5a73]">
                  Solo envíos dentro de México
                </p>

                <button
                    class="w-full rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep"
                    type="button"
                    (click)="checkout()">
                    Ir al pago seguro
                  </button>

                <span class="inline-flex items-center justify-center gap-1.5 rounded-sm bg-white px-2 py-1">
                  <span class="font-display text-[11px] font-black italic leading-none text-[#1A1F71]">VISA</span>
                  <svg class="h-3 w-[19px]" viewBox="0 0 24 14" aria-hidden="true">
                    <circle cx="7" cy="7" r="6.5" fill="#EB001B"/>
                    <circle cx="14" cy="7" r="6.5" fill="#F79E1B"/>
                    <path d="M10.5 2.2c1.35 1.13 2.1 2.85 2.1 4.8s-.75 3.67-2.1 4.8c-1.35-1.13-2.1-2.85-2.1-4.8s.75-3.67 2.1-4.8z" fill="#FF5F00"/>
                  </svg>
                  <span class="rounded-[2px] bg-[#2E77BC] px-1 py-[3px] text-[8px] font-bold leading-none tracking-tight text-white">AMEX</span>
                </span>
              </div>
            }
          </aside>
        </section>

        <section class="mt-12 rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
          <h2 class="mb-6 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Dentro de la caja</h2>
          <ol class="divide-y divide-[#e3eaef]">
            @for (item of BOX_CONTENTS; track item.title; let i = $index) {
              <li class="flex gap-5 py-4">
                <span class="mt-0.5 font-mono text-sm font-bold text-coral">{{ (i + 1).toString().padStart(2, '0') }}</span>
                <div>
                  <h3 class="font-display text-lg font-bold tracking-[-0.02em] text-ink">{{ item.title }}</h3>
                  <p class="text-sm text-[#536875]">{{ item.detail }}</p>
                </div>
              </li>
            }
          </ol>
        </section>
      }
    </div>
  `,
})
export class Experience {
  readonly PACKAGE_MEDIA = PACKAGE_MEDIA;
  readonly BOX_CONTENTS = BOX_CONTENTS;

  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly packages = signal<ProductPackage[]>([]);
  readonly orders = signal<UserOrder[]>([]);
  readonly loading = signal(false);
  readonly package = computed(() => this.packages().find((p) => p.key === 'libro_sorpresa_fisico') ?? null);
  readonly activeOrder = computed(() => this.orders().find(orderIsActive) ?? null);
  readonly blocked = computed(() => Boolean(this.activeOrder() && !orderFeedbackDone(this.activeOrder()!)));
  readonly delivered = computed(() => this.activeOrder()?.fulfillment?.status === 'delivered');

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [packages, orders] = await Promise.all([this.api.listPackages(), this.api.listOrders()]);
      this.packages.set(packages);
      this.orders.set(orders);
      const pkg = packages.find((p) => p.key === 'libro_sorpresa_fisico') ?? null;
      if (pkg) {
        trackMetaEvent('ViewContent', {
          content_name: pkg.name,
          content_type: 'product',
          content_ids: [pkg.key],
          value: (pkg.priceCents + pkg.shippingCents) / 100,
          currency: pkg.currency,
        });
      }
    } finally {
      this.loading.set(false);
    }
  }

  goToOrder(): void {
    void this.router.navigate(['/app/mi-paquete']);
  }

  checkout(): void {
    const pkg = this.package();
    if (!pkg) return;
    trackMetaEvent('InitiateCheckout', {
      content_name: pkg.name,
      content_type: 'product',
      content_ids: [pkg.key],
      value: (pkg.priceCents + pkg.shippingCents) / 100,
      currency: pkg.currency,
      num_items: 1,
    });
    const session = this.auth.session();
    const params = new URLSearchParams();
    if (session?.user.email) params.set('prefilled_email', session.user.email);
    if (session?.user.id) params.set('client_reference_id', `${pkg.key}-${session.user.id}`);
    const query = params.toString();
    window.location.assign(query ? `${PAYMENT_LINK}?${query}` : PAYMENT_LINK);
  }
}
