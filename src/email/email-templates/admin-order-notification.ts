import { button, escapeHtml, factsBlock, Fact, renderLayout } from './layout';

export type AdminOrderNotificationVars = {
  orderRef: string;
  customerName: string;
  customerEmail: string;
  packageName: string;
  subtotalLabel: string;
  shippingLabel: string;
  totalLabel: string;
  address?: string | null;
  adminUrl: string;
};

export function renderAdminOrderNotification(v: AdminOrderNotificationVars): { subject: string; html: string } {
  const facts: Fact[] = [
    { label: 'Pedido', value: v.orderRef },
    { label: 'Cliente', value: `${v.customerName} · ${v.customerEmail}` },
    { label: 'Paquete', value: v.packageName },
    { label: 'Subtotal', value: v.subtotalLabel },
    { label: 'Envío', value: v.shippingLabel },
    { label: 'Total', value: v.totalLabel },
  ];
  if (v.address) facts.push({ label: 'Envío a', value: v.address });

  const children = `
    <div class="email-pad" style="padding:32px 32px 8px;">
      <h1 style="margin:0;font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:-0.04em;line-height:1.05;color:#132a3a;">Nuevo pedido recibido.</h1>
      <p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Se registró el pedido <strong>${escapeHtml(v.orderRef)}</strong> de ${escapeHtml(v.packageName)}. Ya está en espera de curación.</p>
      ${factsBlock(facts)}
      ${button(v.adminUrl, 'Revisar en el panel')}
    </div>`;

  return {
    subject: `Nuevo pedido ${v.orderRef} · ${v.customerName}`,
    html: renderLayout({
      preheader: `Nuevo pedido ${v.orderRef} de ${v.customerName} por ${v.totalLabel}.`,
      eyebrow: 'Nuevo pedido',
      children,
      footerNote: `Pedido ${v.orderRef}`,
    }),
  };
}
