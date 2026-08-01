import { describe, expect, it } from 'vitest';
import { normalizeIsbn } from '../src/books/catalog.service';
import { FeedbackInvitationService } from '../src/feedback/feedback-invitation.service';

describe('normalizeIsbn', () => {
  it('convierte ISBN-10 a ISBN-13', () => {
    expect(normalizeIsbn('0306406152')).toBe('9780306406157');
  });

  it('normaliza guiones y espacios', () => {
    expect(normalizeIsbn('978-0-306-40615-7')).toBe('9780306406157');
    expect(normalizeIsbn('9780 306 40615 7')).toBe('9780306406157');
  });

  it('rechaza formatos inválidos', () => {
    expect(normalizeIsbn('hola')).toBeNull();
    expect(normalizeIsbn('123')).toBeNull();
  });
});

describe('FeedbackInvitationService token', () => {
  it('genera tokens determinísticos y solo persiste el hash', () => {
    const service = new FeedbackInvitationService();
    const id = '00000000-0000-0000-0000-000000000001';
    const token = service.generateToken(id);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(service.hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(service.hashToken(token)).not.toBe(token);
  });

  it('el mismo token produce el mismo hash', () => {
    const service = new FeedbackInvitationService();
    const id = '00000000-0000-0000-0000-000000000002';
    const token = service.generateToken(id);
    expect(service.hashToken(token)).toBe(service.hashToken(token));
  });

  it('el mismo id de invitación re-deriva el mismo token (recuperable)', () => {
    const service = new FeedbackInvitationService();
    const id = '00000000-0000-0000-0000-000000000003';
    expect(service.generateToken(id)).toBe(service.generateToken(id));
  });

  it('ids distintos producen tokens distintos', () => {
    const service = new FeedbackInvitationService();
    const a = service.generateToken('00000000-0000-0000-0000-00000000000a');
    const b = service.generateToken('00000000-0000-0000-0000-00000000000b');
    expect(a).not.toBe(b);
  });
});
