import { Component, Input } from '@angular/core';

export const ORDER_STEPS = ['Orden recibida', 'Selección de libro', 'Preparación de orden', 'Enviado', 'En proceso de entrega'];

export const FULFILLMENT_LABELS: Record<string, string> = {
  curation_pending: 'Orden recibida',
  assigned: 'Selección de libro',
  packed: 'Preparación de orden',
  shipped: 'Enviado',
  delivered: 'En proceso de entrega',
  canceled: 'Cancelado',
};

export function stepReachedFor(status: string): number {
  switch (status) {
    case 'curation_pending': return 1;
    case 'assigned': return 2;
    case 'packed': return 3;
    case 'shipped': return 4;
    case 'delivered': return 5;
    default: return 0;
  }
}

@Component({
  selector: 'app-order-timeline',
  imports: [],
  template: `
    <ol class="divide-y divide-[#e3eaef]">
      @for (step of ORDER_STEPS; track step; let i = $index) {
        <li class="flex items-center gap-3 py-2.5">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold"
            [class.bg-coral]="i < reached"
            [class.text-white]="i < reached"
            [class.bg-[#eef3f6]]="i >= reached"
            [class.text-[#7d9ab0]]="i >= reached">{{ i + 1 }}</span>
          <span class="text-sm font-semibold" [class.text-ink]="i < reached" [class.text-[#7d9ab0]]="i >= reached">{{ step }}</span>
          @if (i === reached - 1) {
            <span class="ml-auto rounded-full bg-marker px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-ink">Actual</span>
          }
        </li>
      }
    </ol>
  `,
})
export class OrderTimeline {
  readonly ORDER_STEPS = ORDER_STEPS;
  @Input() status = '';

  get reached(): number {
    return stepReachedFor(this.status);
  }
}
