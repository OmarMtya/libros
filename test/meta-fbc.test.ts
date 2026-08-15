import { describe, expect, it } from 'vitest';
import { decodeFbcFromClientReference, MetaCapiService } from '../src/meta/meta-capi.service';
import { OrdersService } from '../src/orders/orders.service';

describe('decodeFbcFromClientReference', () => {
  it('decodes a valid URL-safe fbc value', () => {
    const fbc = 'fb.1.1712345678901.example-click-id';
    const encoded = Buffer.from(fbc, 'utf8').toString('base64url');

    expect(decodeFbcFromClientReference(encoded)).toBe(fbc);
  });

  it('ignores malformed or non-fbc values', () => {
    expect(decodeFbcFromClientReference('not-valid*')).toBeNull();
    expect(decodeFbcFromClientReference(Buffer.from('fbp.1.browser').toString('base64url'))).toBeNull();
  });

  it('keeps the existing client reference format compatible', () => {
    const service = new OrdersService({} as never, {} as never, {} as never);
    const legacy = (service as unknown as { parseClientReference(reference: string): { userId: string; fbc: string | null } })
      .parseClientReference('libro_sorpresa_fisico-user-123');
    const fbc = 'fb.1.1712345678901.example-click-id';
    const encoded = Buffer.from(fbc, 'utf8').toString('base64url');
    const current = (service as unknown as { parseClientReference(reference: string): { userId: string; fbc: string | null } })
      .parseClientReference(`libro_sorpresa_fisico-user-123_meta_fbc_${encoded}`);

    expect(legacy).toMatchObject({ userId: 'user-123', fbc: null });
    expect(current).toMatchObject({ userId: 'user-123', fbc });
  });

  it('includes fbc unchanged in the CAPI user data payload', () => {
    const service = new MetaCapiService();
    const payload = (service as unknown as { buildEvent(event: unknown, testEventCode: string | null): { user_data?: unknown } })
      .buildEvent({ eventName: 'Purchase', userData: { fbc: 'fb.1.1712345678901.example-click-id' } }, null);

    expect(payload.user_data).toEqual({ fbc: 'fb.1.1712345678901.example-click-id' });
  });
});
