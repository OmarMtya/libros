import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailTemplateKey, EmailTemplateMap, renderEmail } from './email-templates';

const DEFAULT_FROM = 'Mi Libro Sorpresa <hola@milibrosorpresa.com>';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const enabled = Boolean(apiKey) && process.env.EMAIL_ENABLED !== 'false';
    this.from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
    this.resend = enabled ? new Resend(apiKey) : null;
    if (!this.resend) {
      this.logger.warn('EmailService deshabilitado: falta RESEND_API_KEY o EMAIL_ENABLED=false. Los correos se omitirán.');
    }
  }

  get enabled(): boolean {
    return this.resend !== null;
  }

  async send<K extends EmailTemplateKey>(
    key: K,
    to: string,
    vars: EmailTemplateMap[K],
    idempotencyKey: string,
  ): Promise<void> {
    const { subject, html } = renderEmail(key, vars);
    await this.sendRendered(to, { subject, html }, idempotencyKey);
  }

  async sendRendered(to: string, rendered: { subject: string; html: string }, idempotencyKey: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.log(`[email simulado] ${rendered.subject} -> ${to} (idempotency ${idempotencyKey})`);
      return true;
    }
    try {
      const { data, error } = await this.resend.emails.send(
        { from: this.from, to: [to], subject: rendered.subject, html: rendered.html },
        { idempotencyKey },
      );
      if (error) {
        this.logger.error(`Fallo al enviar ${rendered.subject} a ${to}: ${error.message}`);
        return false;
      }
      this.logger.log(`Correo ${rendered.subject} enviado a ${to} (${data?.id ?? 'sin id'})`);
      return true;
    } catch (error) {
      this.logger.error(`Error inesperado enviando correo a ${to}:`, error instanceof Error ? error.stack : error);
      return false;
    }
  }
}
