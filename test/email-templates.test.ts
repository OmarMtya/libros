import { describe, expect, it } from 'vitest';
import { renderEmail } from '../src/email/email-templates';

const TRACK_URL = 'https://app.example.com/app/mi-paquete';

describe('email templates', () => {
  it('order-confirmation incluye datos del pedido, CTA y marca', () => {
    const { subject, html } = renderEmail('order-confirmation', {
      firstName: 'Ana',
      packageName: 'Mi libro Sorpresa',
      orderRef: 'LS-ABC12345',
      totalLabel: '$499 MXN',
      address: 'Ana · Calle 1 · CDMX',
      trackUrl: TRACK_URL,
    });
    expect(subject).toContain('confirmado');
    expect(html).toContain('Confirmación de pedido');
    expect(html).toContain('Mi libro Sorpresa');
    expect(html).toContain('LS-ABC12345');
    expect(html).toContain('$499 MXN');
    expect(html).toContain('Ana · Calle 1 · CDMX');
    expect(html).toContain(TRACK_URL);
    expect(html).toContain('Seguir mi pedido');
    expect(html).toContain('#bd4937');
    expect(html).toContain('#f2be45');
    expect(html).toContain('Recibimos tu pago');
  });

  it('order-confirmation funciona sin dirección de envío', () => {
    const { html } = renderEmail('order-confirmation', {
      firstName: 'Ana',
      packageName: 'Mi libro Sorpresa',
      orderRef: 'LS-ABC12345',
      totalLabel: '$499 MXN',
      trackUrl: TRACK_URL,
    });
    expect(html).toContain('Seguir mi pedido');
    expect(html).not.toContain('Envío a');
  });

  it('shipped incluye la guía de rastreo', () => {
    const { subject, html } = renderEmail('shipped', {
      firstName: 'Luis',
      packageName: 'Mi libro Sorpresa',
      trackingNumber: 'G123456',
      trackUrl: TRACK_URL,
    });
    expect(subject).toBe('Tu libro sorpresa va en camino');
    expect(html).toContain('Una caja viajando hacia ti.');
    expect(html).toContain('G123456');
    expect(html).toContain(TRACK_URL);
    expect(html).not.toContain('Paquetería');
  });

  it('shipped incluye la paquetería cuando existe', () => {
    const { html } = renderEmail('shipped', {
      firstName: 'Luis',
      packageName: 'Mi libro Sorpresa',
      trackingNumber: 'G123456',
      trackingCarrier: 'Estafeta',
      trackUrl: TRACK_URL,
    });
    expect(html).toContain('Paquetería');
    expect(html).toContain('Estafeta');
    expect(html).toContain('G123456');
  });

  it('shipped muestra "Disponible próximamente" sin guía', () => {
    const { html } = renderEmail('shipped', {
      firstName: 'Luis',
      packageName: 'Mi libro Sorpresa',
      trackingNumber: null,
      trackUrl: TRACK_URL,
    });
    expect(html).toContain('Disponible próximamente');
    expect(html).not.toContain('Paquetería');
  });

  it('delivered incluye libro, enlace de feedback y callout', () => {
    const feedbackUrl = 'https://app.example.com/feedback/tok123';
    const { subject, html } = renderEmail('delivered', {
      firstName: 'Ana',
      book: { title: 'La Casa de los Espíritus', author: 'Isabel Allende', coverUrl: 'https://covers.example.com/1-L.jpg' },
      feedbackUrl,
      trackUrl: TRACK_URL,
    });
    expect(subject).toContain('llegó');
    expect(html).toContain('La sorpresa llegó a casa.');
    expect(html).toContain('La Casa de los Espíritus');
    expect(html).toContain('Isabel Allende');
    expect(html).toContain('https://covers.example.com/1-L.jpg');
    expect(html).toContain('Contarnos qué te pareció');
    expect(html).toContain(feedbackUrl);
  });

  it('delivered funciona sin datos del libro', () => {
    const { html } = renderEmail('delivered', {
      firstName: 'Ana',
      book: null,
      feedbackUrl: 'https://app.example.com/feedback/tok123',
      trackUrl: TRACK_URL,
    });
    expect(html).toContain('Contarnos qué te pareció');
    expect(html).not.toContain('El libro que llegó');
  });

  it('admin-order-notification incluye toda la información de la orden', () => {
    const { subject, html } = renderEmail('admin-order-notification', {
      orderRef: 'LS-ABC12345',
      customerName: 'Ana Pérez',
      customerEmail: 'ana@correo.com',
      packageName: 'Mi libro Sorpresa',
      subtotalLabel: '$499 MXN',
      shippingLabel: '$0 MXN',
      totalLabel: '$499 MXN',
      address: 'Ana Pérez · Calle 1 · CDMX',
      adminUrl: 'https://app.example.com/app/admin',
    });
    expect(subject).toContain('LS-ABC12345');
    expect(subject).toContain('Ana Pérez');
    expect(html).toContain('Nuevo pedido');
    expect(html).toContain('ana@correo.com');
    expect(html).toContain('$499 MXN');
    expect(html).toContain('Ana Pérez · Calle 1 · CDMX');
    expect(html).toContain('https://app.example.com/app/admin');
    expect(html).toContain('Revisar en el panel');
  });

  it('admin-order-notification funciona sin dirección de envío', () => {
    const { html } = renderEmail('admin-order-notification', {
      orderRef: 'LS-ABC12345',
      customerName: 'Ana Pérez',
      customerEmail: 'ana@correo.com',
      packageName: 'Mi libro Sorpresa',
      subtotalLabel: '$499 MXN',
      shippingLabel: '$0 MXN',
      totalLabel: '$499 MXN',
      adminUrl: 'https://app.example.com/app/admin',
    });
    expect(html).toContain('Revisar en el panel');
    expect(html).not.toContain('Envío a');
  });

  it('escapa variables dinámicas para evitar inyección HTML', () => {
    const { html } = renderEmail('order-confirmation', {
      firstName: '<script>alert(1)</script>',
      packageName: '<b>paquete</b>',
      orderRef: 'O"1',
      totalLabel: '$1',
      trackUrl: 'https://x.com/?a=">',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>paquete</b>');
    expect(html).toContain('&lt;b&gt;paquete&lt;/b&gt;');
  });
});
