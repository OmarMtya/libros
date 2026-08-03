import { button, escapeHtml, factsBlock, Fact, renderLayout } from './layout';

export type OrderConfirmationVars = {
  firstName: string;
  packageName: string;
  orderRef: string;
  totalLabel: string;
  address?: string | null;
  trackUrl: string;
};

export function renderOrderConfirmation(v: OrderConfirmationVars): { subject: string; html: string } {
  const facts: Fact[] = [
    { label: 'Paquete', value: v.packageName },
    { label: 'Pedido', value: v.orderRef },
    { label: 'Total', value: v.totalLabel },
  ];
  if (v.address) facts.push({ label: 'Envío a', value: v.address });

  const children = `
    <div class="email-pad" style="padding:32px 32px 8px;">
      <h1 style="margin:0;font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:-0.04em;line-height:1.05;color:#132a3a;">Tu sorpresa ya está en marcha.</h1>
      <p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Hola ${escapeHtml(v.firstName)}, recibimos tu pago y tu pedido <strong>${escapeHtml(v.packageName)}</strong> ya está en selección. Una persona elegirá tu libro a partir de lo que nos contaste.</p>
      ${factsBlock(facts)}
      ${button(v.trackUrl, 'Seguir mi pedido')}
      <p style="margin:20px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#567088;">Los envíos tardan de 5 a 10 días hábiles. Te avisaremos en cada paso de tu pedido.</p>
    </div>`;

  return {
    subject: `Tu pedido de ${v.packageName} está confirmado`,
    html: renderLayout({
      preheader: `Recibimos tu pago. Tu libro sorpresa está en selección.`,
      eyebrow: 'Confirmación de pedido',
      children,
      footerNote: `Pedido ${v.orderRef}`,
    }),
  };
}
