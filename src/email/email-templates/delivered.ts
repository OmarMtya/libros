import { button, escapeHtml, renderLayout } from './layout';

export type DeliveredBook = {
  title: string;
  author?: string | null;
  coverUrl?: string | null;
};

export type DeliveredVars = {
  firstName: string;
  book?: DeliveredBook | null;
  feedbackUrl: string;
  trackUrl: string;
};

function bookCard(book: DeliveredBook): string {
  const cover = book.coverUrl
    ? `<td width="76" valign="top" style="padding-right:16px;">
         <img src="${escapeHtml(book.coverUrl)}" alt="Portada de ${escapeHtml(book.title)}" width="76" height="114" style="display:block;width:76px;height:auto;border:1px solid #e3eaef;border-radius:1px;">
       </td>`
    : '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr>
        <td style="border:1px solid #e3eaef;border-radius:2px;padding:16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${cover}
              <td valign="middle">
                <p style="margin:0 0 4px;font-family:'IBM Plex Mono',Consolas,'Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#567088;">El libro que llegó</p>
                <p style="margin:0;font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:19px;font-weight:700;letter-spacing:-0.02em;line-height:1.15;color:#132a3a;">${escapeHtml(book.title)}</p>
                ${book.author ? `<p style="margin:6px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:14px;color:#536875;">${escapeHtml(book.author)}</p>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function feedbackCallout(feedbackUrl: string): string {
  const href = escapeHtml(feedbackUrl);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
      <tr>
        <td style="background-color:#fdf3d7;border-left:3px solid #f2be45;border-radius:0 2px 2px 0;padding:20px 24px;">
          <p style="margin:0 0 6px;font-family:'IBM Plex Mono',Consolas,'Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#6b5310;">Tu opinión nos ayuda</p>
          <p style="margin:0 0 14px;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#6b5310;">Cuéntanos qué te pareció el libro y qué tan bien te encajó. Con tu feedback afinamos tu siguiente recomendación.</p>
          ${button(feedbackUrl, 'Contarnos qué te pareció')}
          <p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#6b5310;">¿No funciona el botón? Abre este enlace: <a href="${href}" style="color:#6b5310;text-decoration:underline;">${href}</a></p>
        </td>
      </tr>
    </table>`;
}

export function renderDelivered(v: DeliveredVars): { subject: string; html: string } {
  const bookSection = v.book ? bookCard(v.book) : '';
  const children = `
    <div class="email-pad" style="padding:32px 32px 8px;">
      <h1 style="margin:0;font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:-0.04em;line-height:1.05;color:#132a3a;">La sorpresa llegó a casa.</h1>
      <p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Hola ${escapeHtml(v.firstName)}, tu libro ya está contigo. Esperamos que la primera página te lleve a un buen lugar.</p>
      ${bookSection}
      ${feedbackCallout(v.feedbackUrl)}
      <p style="margin:20px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#567088;">Al dejar tu feedback podrás pedir tu siguiente sorpresa.</p>
    </div>`;

  return {
    subject: 'Tu libro llegó — cuéntanos qué te pareció',
    html: renderLayout({
      preheader: 'Tu libro llegó. Cuéntanos qué te pareció y afinamos tu próxima sorpresa.',
      eyebrow: 'Tu libro llegó',
      children,
    }),
  };
}
