export type Fact = { label: string; value: string };

export type LayoutArgs = {
  preheader: string;
  eyebrow: string;
  children: string;
  footerNote?: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function button(url: string, label: string): string {
  const href = escapeHtml(url);
  const text = escapeHtml(label);
  return `
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:210px;" arcsize="6%" stroke="f" fillcolor="#bd4937">
      <w:anchorlock/>
      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:700;">${text}</center>
    </v:roundrect>
    <![endif]-->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">
      <tr>
        <td align="center" style="border-radius:2px;background-color:#bd4937;">
          <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:2px;">${text}</a>
        </td>
      </tr>
    </table>
    <!--[if mso]>
    <div style="display:none;">
    <![endif]-->`;
}

export function factsBlock(facts: Fact[]): string {
  const rows = facts
    .map((fact, index) => {
      const isLast = index === facts.length - 1;
      const border = isLast ? '' : ';border-bottom:1px solid #e3eaef';
      return `
      <tr>
        <td style="padding:12px 16px${border}">
          <p style="margin:0 0 2px;font-family:'IBM Plex Mono',Consolas,'Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:#567088;">${escapeHtml(fact.label)}</p>
          <p style="margin:0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#132a3a;">${escapeHtml(fact.value)}</p>
        </td>
      </tr>`;
    })
    .join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;">
      <tr>
        <td style="border:1px solid #e3eaef;border-radius:2px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
        </td>
      </tr>
    </table>`;
}

export function renderLayout(args: LayoutArgs): string {
  const title = args.eyebrow;
  const footerNote = args.footerNote ? `<p style="margin:12px 0 0;font-family:'IBM Plex Mono',Consolas,'Courier New',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#8fa8bc;">${escapeHtml(args.footerNote)}</p>` : '';
  return `<!doctype html>
<html lang="es-MX">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  <style>
    @media screen and (max-width:600px) {
      .email-container { width: 100% !important; }
      .email-card { border-radius: 0 !important; }
      .email-pad { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f7f8;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(args.preheader)}&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7f8;">
    <tr>
      <td align="center" style="padding:32px 12px 40px;">
        <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <tr>
            <td style="padding:0 0 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:20px;font-weight:800;letter-spacing:-0.03em;line-height:1.1;color:#132a3a;">
                    Mi Libro <span style="background-color:#f2be45;padding:0 3px;border-radius:1px;">Sorpresa</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px;font-family:'IBM Plex Mono',Consolas,'Courier New',monospace;font-size:10px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:#567088;">
                    ${escapeHtml(args.eyebrow)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="email-card" style="border:1px solid #cad7df;border-top:4px solid #dd5d46;background-color:#ffffff;border-radius:2px;">
              ${args.children}
            </td>
          </tr>

          <tr>
            <td style="padding:28px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#132a3a;border-radius:2px;">
                <tr>
                  <td style="padding:26px 24px;">
                    <p style="margin:0 0 10px;font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:18px;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">Mi Libro <span style="background-color:#f2be45;color:#132a3a;padding:0 3px;border-radius:1px;">Sorpresa</span></p>
                    <p style="margin:0 0 16px;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#c6d3de;">Libros elegidos con datos, criterio y cuidado.</p>
                    <p style="margin:0;font-family:'IBM Plex Mono',Consolas,'Courier New',monospace;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#8fa8bc;">Mi Libro Sorpresa · México · <a href="mailto:hola@milibrosorpresa.com" style="color:#8fa8bc;text-decoration:underline;">hola@milibrosorpresa.com</a></p>
                    ${footerNote}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
