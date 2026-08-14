import { button, escapeHtml, factsBlock, Fact, renderLayout } from './layout';

export type ShippedVars = {
  firstName: string;
  packageName: string;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  trackUrl: string;
};

export function renderShipped(v: ShippedVars): { subject: string; html: string } {
  const facts: Fact[] = [
    { label: 'Paquete', value: v.packageName },
    { label: 'Guía', value: v.trackingNumber ?? 'Disponible próximamente' },
  ];
  if (v.trackingCarrier) {
    facts.push({ label: 'Paquetería', value: v.trackingCarrier });
  }
  const trackingSummary = [v.trackingCarrier, v.trackingNumber].filter(Boolean).join(' · ') || 'disponible próximamente';

  const children = `
    <div class="email-pad" style="padding:32px 32px 8px;">
      <h1 style="margin:0;font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:-0.04em;line-height:1.05;color:#132a3a;">Una caja viajando hacia ti.</h1>
      <p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Hola ${escapeHtml(v.firstName)}, tu libro sorpresa ya salió de nuestras manos. Prepara un buen lugar para recibirlo.</p>
      ${factsBlock(facts)}
      ${button(v.trackUrl, 'Seguir mi pedido')}
      <p style="margin:20px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#567088;">El número de guía puede tardar un poco en actualizarse con la paquetería.</p>
    </div>`;

  return {
    subject: 'Tu libro sorpresa va en camino',
    html: renderLayout({
      preheader: `Tu libro sorpresa va en camino. Guía ${trackingSummary}.`,
      eyebrow: 'Tu sorpresa va en camino',
      children,
    }),
  };
}
