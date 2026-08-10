import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrdersService } from '../src/orders/orders.service';

function createService() {
  const tx = {
    paymentEvent: {
      create: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
    productPackage: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    order: {
      create: vi.fn().mockResolvedValue({
        id: 'order-1',
        subtotalCents: 0,
        shippingCents: 0,
        totalCents: 0,
      }),
    },
    payment: {
      create: vi.fn().mockResolvedValue({ id: 'payment-1' }),
    },
    fulfillment: {
      create: vi.fn().mockResolvedValue({ id: 'fulfillment-1' }),
    },
  };

  const prisma = {
    productPackage: { findUnique: vi.fn() },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  };

  const email = { send: vi.fn().mockResolvedValue(undefined) };
  const service = new OrdersService(prisma as never, email as never);
  return { service, prisma, tx };
}

describe('OrdersService admin free orders', () => {
  let service: OrdersService;
  let prisma: ReturnType<typeof createService>['prisma'];
  let tx: ReturnType<typeof createService>['tx'];

  beforeEach(() => {
    ({ service, prisma, tx } = createService());
  });

  it('rejects an unknown user before creating an order', async () => {
    prisma.productPackage.findUnique.mockResolvedValue({
      id: 'package-1',
      key: 'libro_sorpresa_fisico',
      isActive: true,
      currency: 'MXN',
    });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.createAdminOrder('missing-user')).rejects.toThrow('cliente de la compra no existe');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an inactive package before creating an order', async () => {
    prisma.productPackage.findUnique.mockResolvedValue({
      id: 'package-1',
      key: 'libro_sorpresa_fisico',
      isActive: false,
      currency: 'MXN',
    });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

    await expect(service.createAdminOrder('user-1')).rejects.toThrow('paquete de la compra no está disponible');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a free order through the shared flow without a payment record', async () => {
    const product = {
      id: 'package-1',
      key: 'libro_sorpresa_fisico',
      name: 'Mi Libro Sorpresa',
      priceCents: 49900,
      shippingCents: 9900,
      currency: 'MXN',
      isActive: true,
    };
    prisma.productPackage.findUnique.mockResolvedValue(product);
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: null, displayName: 'Lector' });
    tx.productPackage.findUnique.mockResolvedValue(product);
    tx.user.findUnique.mockResolvedValue({ id: 'user-1', email: null, displayName: 'Lector' });

    await expect(service.createAdminOrder('user-1')).resolves.toEqual({ received: true, processed: true });

    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        packageId: 'package-1',
        subtotalCents: 0,
        shippingCents: 0,
        totalCents: 0,
        paidAt: null,
      }),
    });
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.paymentEvent.update).not.toHaveBeenCalled();
    expect(tx.fulfillment.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        internalNotes: 'Orden administrativa sin cobro.',
      },
    });
  });

  it('keeps the paid webhook path creating a payment and paidAt', async () => {
    const product = {
      id: 'package-1',
      key: 'libro_sorpresa_fisico',
      name: 'Mi Libro Sorpresa',
      priceCents: 49900,
      shippingCents: 9900,
      currency: 'MXN',
      isActive: true,
    };
    prisma.user.findMany.mockResolvedValue([]);
    tx.productPackage.findUnique.mockResolvedValue(product);
    tx.user.findUnique.mockResolvedValue({ id: 'user-1', email: null, displayName: 'Lector' });
    tx.order.create.mockResolvedValue({
      id: 'order-paid',
      subtotalCents: product.priceCents,
      shippingCents: product.shippingCents,
      totalCents: 59800,
    });

    await expect(service.processStripeEvent({
      id: 'evt_paid_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_paid_1',
          client_reference_id: 'libro_sorpresa_fisico-user-1',
          payment_status: 'paid',
          amount_total: 59800,
          currency: 'mxn',
        },
      },
    } as never)).resolves.toEqual({ received: true, processed: true });

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 'order-paid',
        amountCents: 59800,
        status: 'paid',
      }),
    });
    expect(tx.paymentEvent.update).toHaveBeenCalledWith({
      where: { providerEventId: 'evt_paid_1' },
      data: { paymentId: 'payment-1' },
    });
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paidAt: expect.any(Date),
        totalCents: 59800,
      }),
    });
  });
});
