import { button, escapeHtml, factsBlock, Fact, renderLayout } from './layout';

export type GoodreadsImportedVars = {
  firstName: string;
  importedCount: number;
  enjoyedCount: number;
  notEnjoyedCount: number;
  profileUrl: string;
};

export function renderGoodreadsImported(v: GoodreadsImportedVars): { subject: string; html: string } {
  const facts: Fact[] = [
    { label: 'Libros importados', value: String(v.importedCount) },
    { label: 'Disfrutados', value: String(v.enjoyedCount) },
    { label: 'No disfrutados', value: String(v.notEnjoyedCount) },
  ];
  const children = `
    <div class="email-pad" style="padding:32px 32px 8px;">
      <h1 style="margin:0;font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:-0.04em;line-height:1.05;color:#132a3a;">Tu biblioteca ya está lista.</h1>
      <p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Hola ${escapeHtml(v.firstName)}, ya terminamos de importar toda tu biblioteca de Goodreads. Tu perfil lector está listo y te esperamos para acompañarte en tu próxima lectura.</p>
      ${factsBlock(facts)}
      <p style="margin:20px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Usamos tus calificaciones para entender mejor tus gustos y elegir historias que puedan sorprenderte.</p>
      ${button(v.profileUrl, 'Ver mi perfil lector')}
    </div>`;

  return {
    subject: 'Tu biblioteca de Goodreads ya está importada',
    html: renderLayout({
      preheader: `${v.importedCount} libros de Goodreads ya forman parte de tu perfil lector.`,
      eyebrow: 'Goodreads importado',
      children,
      footerNote: 'Biblioteca actualizada',
    }),
  };
}
