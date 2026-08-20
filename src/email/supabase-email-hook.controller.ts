import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Controller, Headers, HttpCode, Post, Req, ServiceUnavailableException } from '@nestjs/common';
import { Request } from 'express';
import { renderAuthEmail } from './auth-email-templates';
import { EmailService } from './email.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

type SendEmailPayload = {
  user?: {
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
};

@Controller('v1/webhooks/supabase')
export class SupabaseEmailHookController {
  constructor(private readonly email: EmailService) {}

  @Post('email')
  @HttpCode(200)
  async receive(
    @Req() request: RawBodyRequest,
    @Headers('webhook-id') webhookId?: string,
    @Headers('webhook-timestamp') webhookTimestamp?: string,
    @Headers('webhook-signature') webhookSignature?: string,
  ): Promise<Record<string, never>> {
    const rawBody = request.rawBody;
    const secret = process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET;
    if (!rawBody || !webhookId || !webhookTimestamp || !webhookSignature || !secret || !verifySupabaseEmailHookSignature(rawBody, {
      id: webhookId,
      timestamp: webhookTimestamp,
      signature: webhookSignature,
    }, secret)) {
      throw new BadRequestException('La firma de la notificación no es válida.');
    }

    let payload: SendEmailPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as SendEmailPayload;
    } catch {
      throw new BadRequestException('El cuerpo de la notificación no es válido.');
    }

    const email = payload.user?.email?.trim().toLowerCase();
    const emailData = payload.email_data;
    const actionType = emailData?.email_action_type;
    if (!email || !actionType) throw new BadRequestException('La notificación no contiene una acción de correo válida.');

    const confirmationUrl = this.confirmationUrl(emailData);
    const rendered = renderAuthEmail({
      actionType,
      email,
      fullName: this.fullName(payload.user?.user_metadata),
      confirmationUrl,
      token: emailData?.token,
    });
    const sent = await this.email.sendRendered(email, rendered, `supabase-auth:${webhookId}`);
    if (!sent) throw new ServiceUnavailableException('No se pudo enviar el correo de autenticación.');
    return {};
  }

  private confirmationUrl(emailData: SendEmailPayload['email_data']): string | null {
    if (!emailData?.token_hash || emailData.email_action_type === 'reauthentication') return null;
    const issuer = process.env.SUPABASE_JWT_ISSUER?.replace(/\/$/, '');
    if (!issuer) return null;
    const url = new URL(`${issuer}/verify`);
    url.searchParams.set('token', emailData.token_hash);
    url.searchParams.set('type', emailData.email_action_type ?? '');
    url.searchParams.set('redirect_to', emailData.redirect_to ?? emailData.site_url ?? '');
    return url.toString();
  }

  private fullName(metadata: Record<string, unknown> | undefined): string | null {
    const value = metadata?.['full_name'];
    return typeof value === 'string' && value.trim() ? value : null;
  }
}

export function verifySupabaseEmailHookSignature(
  rawBody: Buffer,
  headers: { id: string; timestamp: string; signature: string },
  secret: string,
  now = Date.now(),
): boolean {
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > 300) return false;
  const secretValue = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
  const secretBytes = Buffer.from(secretValue, 'base64');
  if (secretBytes.length === 0) return false;
  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest();

  return headers.signature.trim().split(/\s+/).some((value) => {
    const [version, encoded] = value.split(',', 2);
    if (version !== 'v1' || !encoded) return false;
    const candidate = Buffer.from(encoded, 'base64');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}
