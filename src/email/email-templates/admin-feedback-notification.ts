import { button, escapeHtml, factsBlock, Fact, renderLayout } from './layout';

export type AdminFeedbackNotificationVars = {
  readerName: string;
  readerEmail: string;
  bookTitle: string;
  readingStatusLabel: string;
  ratingLabel: string;
  comment?: string | null;
  adminUrl: string;
};

export function renderAdminFeedbackNotification(v: AdminFeedbackNotificationVars): { subject: string; html: string } {
  const facts: Fact[] = [
    { label: 'Lector', value: `${v.readerName} · ${v.readerEmail}` },
    { label: 'Libro', value: v.bookTitle },
    { label: 'Estado', value: v.readingStatusLabel },
    { label: 'Qué tan bien encajó', value: v.ratingLabel },
  ];
  const commentBlock = v.comment
    ? `<blockquote style="margin:20px 0 0;padding:14px 18px;border-left:3px solid #f2be45;background-color:#fdf3d7;border-radius:0 2px 2px 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#132a3a;">${escapeHtml(v.comment)}</blockquote>`
    : '';

  const children = `
    <div class="email-pad" style="padding:32px 32px 8px;">
      <h1 style="margin:0;font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:-0.04em;line-height:1.05;color:#132a3a;">Nuevo feedback recibido.</h1>
      <p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">${escapeHtml(v.readerName)} compartió su opinión sobre <strong>${escapeHtml(v.bookTitle)}</strong>.</p>
      ${factsBlock(facts)}
      ${commentBlock}
      ${button(v.adminUrl, 'Revisar en el panel')}
    </div>`;

  return {
    subject: `Nuevo feedback · ${v.bookTitle}`,
    html: renderLayout({
      preheader: `${v.readerName} dejó feedback sobre ${v.bookTitle}.`,
      eyebrow: 'Nuevo feedback',
      children,
      footerNote: 'Feedback recibido',
    }),
  };
}
