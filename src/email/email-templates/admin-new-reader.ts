import { button, escapeHtml, factsBlock, Fact, renderLayout } from './layout';

export type AdminNewReaderVars = {
  readerName: string;
  readerEmail: string;
  readerUrl: string;
};

export function renderAdminNewReader(v: AdminNewReaderVars): { subject: string; html: string } {
  const facts: Fact[] = [{ label: 'Lector', value: `${v.readerName} · ${v.readerEmail}` }];

  const children = `
    <div class="email-pad" style="padding:32px 32px 8px;">
      <h1 style="margin:0;font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:-0.04em;line-height:1.05;color:#132a3a;">Nuevo lector registrado.</h1>
      <p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;"><strong>${escapeHtml(v.readerName)}</strong> terminó su perfil por primera vez y ya está listo para recibir una recomendación. Revisa su ficha en el panel.</p>
      ${factsBlock(facts)}
      ${button(v.readerUrl, 'Revisar su ficha')}
    </div>`;

  return {
    subject: `Nuevo lector · ${v.readerName}`,
    html: renderLayout({
      preheader: `Nuevo lector ${v.readerName} completó su perfil por primera vez.`,
      eyebrow: 'Nuevo lector',
      children,
      footerNote: 'Perfil completado',
    }),
  };
}
