import { Component, Input, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { orderFeedbackDone, orderIsActive, UserOrder } from '../api.service';

@Component({
  selector: 'app-buy-again',
  imports: [RouterLink],
  template: `
    @if (canBuy()) {
      <section class="rounded-sm border border-[#cad7df] bg-white p-6 sm:p-8">
        <p class="font-mono text-xs uppercase tracking-[0.08em] text-[#567088]">Tu próxima sorpresa</p>
        <h2 class="mt-1 font-display text-2xl font-bold tracking-[-0.03em] text-ink">¿Listo para tu siguiente libro?</h2>
        <p class="mt-1 text-sm text-[#536875]">
          Cada sorpresa se elige con lo que aprendemos de ti. Arma la siguiente.
        </p>
        <a
          routerLink="/app/experiencia"
          class="mt-4 inline-block rounded-sm bg-coral px-6 py-3 text-sm font-bold text-white transition hover:bg-coral-deep">
          Comprar mi próxima sorpresa
        </a>
      </section>
    }
  `,
})
export class BuyAgain {
  private readonly ordersSignal = signal<UserOrder[]>([]);

  @Input() set orders(value: UserOrder[]) {
    this.ordersSignal.set(value ?? []);
  }

  readonly canBuy = computed(() => {
    const active = this.ordersSignal().find(orderIsActive) ?? null;
    return !active || orderFeedbackDone(active);
  });
}
