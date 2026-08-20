import { button, escapeHtml, renderLayout } from './email-templates/layout';

export type AuthEmailVars = {
  actionType: string;
  email: string;
  fullName?: string | null;
  confirmationUrl?: string | null;
  token?: string | null;
};

export type RenderedAuthEmail = { subject: string; html: string };

export function renderAuthEmail(vars: AuthEmailVars): RenderedAuthEmail {
  const content = authContent(vars);
  return {
    subject: content.subject,
    html: renderLayout({
      preheader: content.preheader,
      eyebrow: content.eyebrow,
      children: `
        <div class="email-pad" style="padding:32px 32px 8px;">
          <h1 style="margin:0;font-family:'Bricolage Grotesque',Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;letter-spacing:-0.04em;line-height:1.05;color:#132a3a;">${content.title}</h1>
          ${content.body}
          ${content.action}
          <p style="margin:20px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#567088;">Si no solicitaste esta acción, puedes ignorar este correo.</p>
        </div>`,
    }),
  };
}

function authContent(vars: AuthEmailVars): {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  action: string;
} {
  const greeting = vars.fullName?.trim()
    ? `Hola ${escapeHtml(vars.fullName.trim())}, `
    : '';
  const email = escapeHtml(vars.email);

  switch (vars.actionType) {
    case 'signup':
      return {
        subject: 'Confirma tu cuenta · Mi Libro Sorpresa',
        preheader: 'Confirma tu correo para empezar a recibir tu libro sorpresa.',
        eyebrow: 'Confirmación de cuenta',
        title: 'Ya casi estás adentro.',
        body: `<p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">${greeting}confirma tu correo para activar tu cuenta y empezar a armar tu perfil lector.</p><p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Un equipo de personas elegirá un libro sorpresa pensado solo para ti.</p>`,
        action: confirmationAction(vars.confirmationUrl, 'Confirmar mi correo'),
      };
    case 'recovery':
      return {
        subject: 'Restablece tu contraseña · Mi Libro Sorpresa',
        preheader: 'Crea una contraseña nueva para volver a tu perfil lector.',
        eyebrow: 'Recuperación de acceso',
        title: 'Volvamos a abrir tu puerta de entrada.',
        body: `<p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Recibimos una solicitud para restablecer la contraseña de <strong>${email}</strong>.</p><p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Elige una contraseña nueva para volver a tu perfil lector.</p>`,
        action: confirmationAction(vars.confirmationUrl, 'Crear contraseña nueva'),
      };
    case 'reauthentication':
      return {
        subject: 'Confirma tu identidad · Mi Libro Sorpresa',
        preheader: 'Usa este código para confirmar tu identidad.',
        eyebrow: 'Verificación de identidad',
        title: 'Una confirmación rápida.',
        body: `<p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Usa el siguiente código para confirmar que eres tú:</p>`,
        action: `<p style="margin:28px 0 0;text-align:center;font-family:'IBM Plex Mono',Consolas,'Courier New',monospace;font-size:28px;letter-spacing:0.18em;color:#132a3a;">${escapeHtml(vars.token ?? '')}</p>`,
      };
    case 'email_change':
    case 'email_change_new':
      return {
        subject: 'Confirma tu nuevo correo · Mi Libro Sorpresa',
        preheader: 'Confirma el nuevo correo de tu cuenta.',
        eyebrow: 'Cambio de correo',
        title: 'Confirma tu nuevo correo.',
        body: `<p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Confirma este cambio para mantener tu cuenta actualizada.</p>`,
        action: confirmationAction(vars.confirmationUrl, 'Confirmar nuevo correo'),
      };
    default:
      return {
        subject: 'Una acción requiere tu confirmación · Mi Libro Sorpresa',
        preheader: 'Confirma una acción pendiente en tu cuenta.',
        eyebrow: 'Seguridad de tu cuenta',
        title: 'Una acción requiere tu confirmación.',
        body: `<p style="margin:14px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#536875;">Recibimos una solicitud relacionada con la cuenta <strong>${email}</strong>.</p>`,
        action: confirmationAction(vars.confirmationUrl, 'Continuar'),
      };
  }
}

function confirmationAction(url: string | null | undefined, label: string): string {
  if (!url) return '';
  const href = escapeHtml(url);
  return `${button(url, label)}<p style="margin:22px 0 0;font-family:'Instrument Sans',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#567088;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><span style="font-family:'IBM Plex Mono',Consolas,'Courier New',monospace;font-size:12px;color:#567088;word-break:break-all;">${href}</span></p>`;
}
