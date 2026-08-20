import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { renderAuthEmail } from '../src/email/auth-email-templates';
import { verifySupabaseEmailHookSignature } from '../src/email/supabase-email-hook.controller';

const secret = `v1,whsec_${Buffer.from('test-hook-secret').toString('base64')}`;

function signature(body: string, id: string, timestamp: string): string {
  const signed = `${id}.${timestamp}.${body}`;
  return `v1,${createHmac('sha256', 'test-hook-secret').update(signed).digest('base64')}`;
}

describe('Supabase email hook', () => {
  it('verifica la firma estándar del hook y rechaza payloads vencidos', () => {
    const body = JSON.stringify({ email_data: { email_action_type: 'recovery' } });
    const id = 'msg_123';
    const timestamp = '1700000000';
    const now = Number(timestamp) * 1000;

    expect(verifySupabaseEmailHookSignature(Buffer.from(body), {
      id,
      timestamp,
      signature: signature(body, id, timestamp),
    }, secret, now)).toBe(true);
    expect(verifySupabaseEmailHookSignature(Buffer.from(body), {
      id,
      timestamp,
      signature: 'v1,invalid',
    }, secret, now)).toBe(false);
    expect(verifySupabaseEmailHookSignature(Buffer.from(body), {
      id,
      timestamp,
      signature: signature(body, id, timestamp),
    }, secret, now + 301_000)).toBe(false);
  });

  it('renderiza recuperación con el enlace seguro y escapa datos', () => {
    const { subject, html } = renderAuthEmail({
      actionType: 'recovery',
      email: 'ana@example.com',
      confirmationUrl: 'https://example.com/reset?token="abc"',
    });

    expect(subject).toContain('Restablece tu contraseña');
    expect(html).toContain('Crea una contraseña nueva');
    expect(html).toContain('https://example.com/reset?token=&quot;abc&quot;');
    expect(html).toContain('#bd4937');
  });
});
