import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
    constructor(_apiKey?: string) {}
  },
}));

import { EmailService } from '../src/email/email.service';

describe('EmailService', () => {
  const original = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_ENABLED: process.env.EMAIL_ENABLED,
    EMAIL_FROM: process.env.EMAIL_FROM,
  };

  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });
  });

  afterEach(() => {
    for (const key of ['RESEND_API_KEY', 'EMAIL_ENABLED', 'EMAIL_FROM'] as const) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('se deshabilita sin RESEND_API_KEY y no llama a Resend', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_ENABLED;
    const service = new EmailService();
    expect(service.enabled).toBe(false);
    await service.send('shipped', 'ana@example.com', {
      firstName: 'Ana',
      packageName: 'Mi libro Sorpresa',
      trackingNumber: null,
      trackUrl: 'https://app.example.com/app/mi-paquete',
    }, 'idem-1');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('se deshabilita con EMAIL_ENABLED=false aunque haya key', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_ENABLED = 'false';
    const service = new EmailService();
    expect(service.enabled).toBe(false);
    await service.send('order-confirmation', 'ana@example.com', {
      firstName: 'Ana',
      packageName: 'Mi libro Sorpresa',
      orderRef: 'LS-ABC12345',
      totalLabel: '$499 MXN',
      trackUrl: 'https://app.example.com/app/mi-paquete',
    }, 'idem-2');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('envía con remitente, destinatario, asunto, html e idempotencyKey', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_ENABLED = 'true';
    process.env.EMAIL_FROM = 'Mi Libro Sorpresa <hola@milibrosorpresa.com>';
    const service = new EmailService();
    expect(service.enabled).toBe(true);

    await service.send('shipped', 'ana@example.com', {
      firstName: 'Ana',
      packageName: 'Mi libro Sorpresa',
      trackingNumber: 'G123',
      trackUrl: 'https://app.example.com/app/mi-paquete',
    }, 'idem-3');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [payload, options] = sendMock.mock.calls[0]!;
    expect(payload.to).toEqual(['ana@example.com']);
    expect(payload.from).toBe('Mi Libro Sorpresa <hola@milibrosorpresa.com>');
    expect(payload.subject).toBe('Tu libro sorpresa va en camino');
    expect(payload.html).toContain('Seguir mi pedido');
    expect(options.idempotencyKey).toBe('idem-3');
  });

  it('no lanza si Resend devuelve error', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_ENABLED = 'true';
    sendMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const service = new EmailService();

    await expect(service.send('delivered', 'ana@example.com', {
      firstName: 'Ana',
      book: null,
      feedbackUrl: 'https://app.example.com/feedback/tok123',
      trackUrl: 'https://app.example.com/app/mi-paquete',
    }, 'idem-4')).resolves.toBeUndefined();
  });

  it('no lanza si Resend lanza excepción', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_ENABLED = 'true';
    sendMock.mockRejectedValue(new Error('network'));
    const service = new EmailService();

    await expect(service.send('delivered', 'ana@example.com', {
      firstName: 'Ana',
      book: { title: 'El libro', author: null, coverUrl: null },
      feedbackUrl: 'https://app.example.com/feedback/tok123',
      trackUrl: 'https://app.example.com/app/mi-paquete',
    }, 'idem-5')).resolves.toBeUndefined();
  });
});
