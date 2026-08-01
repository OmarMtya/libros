import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, orderFeedbackDone, orderIsActive, UserOrder } from '../api.service';
import { ToastService } from '../toast.service';
import { FULFILLMENT_LABELS, OrderTimeline } from '../components/order-timeline';

@Component({
  selector: 'app-mi-paquete',
  imports: [DatePipe, CurrencyPipe, RouterLink, OrderTimeline],
  template: `
    <div class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p class="mb-2 font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Tu pedido</p>
      <h1 class="mb-8 font-display text-4xl font-bold tracking-[-0.045em] text-ink sm:text-5xl">Mi paquete</h1>

      @if (loading()) {
        <section class="rounded-sm border border-[#cad7df] bg-white p-10 text-center">
          <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Cargando tu pedido…</p>
        </section>
      } @else if (order(); as order) {
        <section class="rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
          <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-display text-2xl font-bold tracking-[-0.03em] text-ink">{{ order.packageName }}</h2>
              <p class="mt-1 text-sm text-[#536875]">Pedido del {{ order.createdAt | date:'longDate' }}</p>
            </div>
            <span class="rounded-full bg-[#e2f0e9] px-3 py-1 font-mono text-xs text-[#16442f]">{{ statusLabel(order) }}</span>
          </div>

          <app-order-timeline [status]="order.fulfillment?.status ?? ''" />

          @if (feedbackDone()) {
            <div class="mt-5 rounded-sm bg-[#e2f0e9] px-4 py-3 text-sm text-[#16442f]">
              ¡Gracias por tu feedback! Ya puedes elegir tu siguiente sorpresa.
            </div>
            <a
              routerLink="/experiencia"
              class="mt-4 inline-block rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep">
              Elegir mi siguiente sorpresa
            </a>
          } @else if (order.fulfillment?.status === 'delivered') {
            <div class="mt-5 rounded-sm border border-[#f0e0b0] bg-[#fff7e6] px-4 py-3 text-sm text-[#6b5310]">
              En tu paquete encontrarás un <strong>código QR</strong>. Escanéalo con tu teléfono para
              contarnos cómo te fue con tu libro; con tu opinión liberamos tu siguiente sorpresa.
            </div>
          } @else {
            <p class="mt-5 text-sm text-[#536875]">
              Tu envío está en proceso. Los envíos tardan de 5 a 10 días hábiles y nos comunicaremos
              contigo en cada paso de tu pedido.
            </p>
          }

          <dl class="mt-6 grid gap-3 border-t border-[#e3eaef] pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt class="font-mono text-xs uppercase tracking-wide text-[#567088]">Total</dt>
              <dd class="mt-0.5 font-bold text-ink">{{ order.totalCents / 100 | currency:'MXN':'$':'1.0-0' }} MXN</dd>
            </div>
            @if (order.fulfillment?.trackingNumber) {
              <div>
                <dt class="font-mono text-xs uppercase tracking-wide text-[#567088]">Guía</dt>
                <dd class="mt-0.5 text-ink">{{ order.fulfillment!.trackingNumber }}</dd>
              </div>
            }
            @if (order.shippingAddress; as address) {
              <div class="sm:col-span-2">
                <dt class="font-mono text-xs uppercase tracking-wide text-[#567088]">Envío a</dt>
                <dd class="mt-0.5 text-[#536875]">
                  {{ address.recipientName }} · {{ address.street }}{{ address.exteriorNumber ? ' ' + address.exteriorNumber : '' }}{{ address.neighborhood ? ', ' + address.neighborhood : '' }}, {{ address.city }}, {{ address.state }} {{ address.postalCode }}
                </dd>
              </div>
            }
          </dl>
        </section>
      } @else {
        <section class="rounded-sm border border-[#cad7df] bg-white p-10 text-center">
          <h2 class="font-display text-2xl font-bold tracking-[-0.03em] text-ink">Aún no tienes un pedido</h2>
          <p class="mt-2 mb-6 text-sm text-[#536875]">Tu próxima sorpresa te está esperando.</p>
          <a
            routerLink="/experiencia"
            class="inline-block rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep">
            Elegir mi sorpresa
          </a>
        </section>
      }
    </div>
  `,
})
export class MiPaquete {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  readonly orders = signal<UserOrder[]>([]);
  readonly loading = signal(true);
  readonly order = computed(() => this.orders().find(orderIsActive) ?? null);
  readonly feedbackDone = computed(() => (this.order() ? orderFeedbackDone(this.order()!) : false));

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.orders.set(await this.api.listOrders());
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'No pudimos cargar tu pedido.');
    } finally {
      this.loading.set(false);
    }
  }

  statusLabel(order: UserOrder): string {
    const status = order.fulfillment?.status ?? '';
    return FULFILLMENT_LABELS[status] ?? 'Pedido';
  }
}
