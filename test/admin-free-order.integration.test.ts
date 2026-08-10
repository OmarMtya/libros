import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { PrismaClient, ProductPackageKey } from '@prisma/client';
import Stripe from 'stripe';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { EmailService } from '../src/email/email.service';
import { OrdersService } from '../src/orders/orders.service';
import { assertTestDatabase } from './helpers/test-database';

const url = process.env.TEST_DATABASE_URL;
const run = describe.runIf(Boolean(url));
assertTestDatabase(url);

const prisma = url ? new PrismaClient({ datasources: { db: { url } } }) : null;
const orders = prisma ? new OrdersService(prisma as never, new EmailService()) : null;

function paidEvent(userId: string, amountTotal: number, currency = 'mxn', packageKey = ProductPackageKey.libro_sorpresa_fisico): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_${randomUUID()}`,
        client_reference_id: `${packageKey}-${userId}`,
        payment_status: 'paid',
        amount_total: amountTotal,
        currency,
      },
    },
  } as unknown as Stripe.Event;
}

function unpaidEvent(userId: string, packageKey = ProductPackageKey.libro_sorpresa_fisico): Stripe.Event {
  return {
    id: `evt_${randomUUID()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_${randomUUID()}`,
        client_reference_id: `${packageKey}-${userId}`,
        payment_status: 'unpaid',
        amount_total: 49900,
        currency: 'mxn',
      },
    },
  } as unknown as Stripe.Event;
}

async function cleanDatabase() {
  if (!prisma) return;
  await prisma.recommendationCandidate.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.readingFeedback.deleteMany();
  await prisma.feedbackInvitation.deleteMany();
  await prisma.curationAssignment.deleteMany();
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
}

run('orden administrativa gratuita', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await prisma?.$disconnect();
  });

  it('crea una orden sin cargo: sin pago, paidAt null y fulfillment en curación', async () => {
    const user = await prisma!.user.create({ data: { email: `free-${randomUUID()}@test.dev`, displayName: 'Cliente Gratis' } });

    const result = await orders!.createAdminOrder({ userId: user.id });

    expect(result).toEqual({ received: true, processed: true });
    const created = await prisma!.order.findFirst({
      where: { userId: user.id },
      include: { payments: true, fulfillment: true },
    });
    expect(created).not.toBeNull();
    expect(created!.packageKey).toBe(ProductPackageKey.libro_sorpresa_fisico);
    expect(created!.status).toBe('curation_pending');
    expect(created!.subtotalCents).toBe(0);
    expect(created!.shippingCents).toBe(0);
    expect(created!.totalCents).toBe(0);
    expect(created!.paidAt).toBeNull();
    expect(created!.payments).toHaveLength(0);
    expect(created!.fulfillment).not.toBeNull();
    expect(created!.fulfillment!.status).toBe('curation_pending');
    expect(created!.fulfillment!.internalNotes).toBe('Orden administrativa sin cobro.');
  });

  it('acepta packageKey explícito y la orden aparece en listAdminOrders', async () => {
    const user = await prisma!.user.create({ data: { email: `free-${randomUUID()}@test.dev` } });

    await orders!.createAdminOrder({ userId: user.id, packageKey: ProductPackageKey.libro_sorpresa_fisico });

    const listed = await orders!.listAdminOrders();
    const entry = listed.find((order) => order.user.id === user.id);
    expect(entry).toBeDefined();
    expect(entry!.packageKey).toBe(ProductPackageKey.libro_sorpresa_fisico);
    expect(entry!.paidAt).toBeNull();
    expect(entry!.payment).toBeNull();
    expect(entry!.fulfillment).not.toBeNull();
    expect(entry!.fulfillment!.status).toBe('curation_pending');
  });

  it('no registra ningún Payment ni rastro de cobro', async () => {
    const user = await prisma!.user.create({ data: { email: `free-${randomUUID()}@test.dev` } });

    await orders!.createAdminOrder({ userId: user.id });
    await orders!.createAdminOrder({ userId: user.id });

    const payments = await prisma!.payment.findMany({ where: { order: { userId: user.id } } });
    expect(payments).toHaveLength(0);
    const ordersForUser = await prisma!.order.findMany({ where: { userId: user.id } });
    expect(ordersForUser).toHaveLength(2);
    expect(ordersForUser.every((order) => order.paidAt === null && order.totalCents === 0)).toBe(true);
    const events = await prisma!.paymentEvent.findMany();
    expect(events.some((event) => event.paymentId !== null)).toBe(false);
  });

  it('rechaza un usuario inexistente', async () => {
    await expect(orders!.createAdminOrder({ userId: randomUUID() })).rejects.toThrow(BadRequestException);
    expect(await prisma!.order.count()).toBe(0);
  });

  it('rechaza un paquete inactivo', async () => {
    const user = await prisma!.user.create({ data: { email: `free-${randomUUID()}@test.dev` } });
    await prisma!.productPackage.update({ where: { key: ProductPackageKey.libro_sorpresa_fisico }, data: { isActive: false } });
    try {
      await expect(orders!.createAdminOrder({ userId: user.id })).rejects.toThrow(BadRequestException);
    } finally {
      await prisma!.productPackage.update({ where: { key: ProductPackageKey.libro_sorpresa_fisico }, data: { isActive: true } });
    }
    expect(await prisma!.order.count()).toBe(0);
  });

  it('el webhook pagado sigue creando pago y paidAt (comportamiento intacto)', async () => {
    const user = await prisma!.user.create({ data: { email: `paid-${randomUUID()}@test.dev` } });
    const pkg = await prisma!.productPackage.findUnique({ where: { key: ProductPackageKey.libro_sorpresa_fisico } });
    const amount = pkg!.priceCents + pkg!.shippingCents;

    const result = await orders!.processStripeEvent(paidEvent(user.id, amount));

    expect(result).toMatchObject({ received: true, processed: true });
    const created = await prisma!.order.findFirst({
      where: { userId: user.id },
      include: { payments: true, fulfillment: true },
    });
    expect(created).not.toBeNull();
    expect(created!.paidAt).not.toBeNull();
    expect(created!.totalCents).toBe(amount);
    expect(created!.payments).toHaveLength(1);
    const payment = created!.payments[0]!;
    expect(payment.amountCents).toBe(amount);
    expect(payment.status).toBe('paid');
    expect(payment.externalSessionId).toContain('cs_');
    expect(created!.fulfillment).not.toBeNull();
    expect(created!.fulfillment!.internalNotes).toBeNull();
    const event = await prisma!.paymentEvent.findFirst({ where: { eventType: 'checkout.session.completed' } });
    expect(event?.paymentId).not.toBeNull();
  });

  it('ignora un evento no pagado sin crear orden', async () => {
    const user = await prisma!.user.create({ data: { email: `unpaid-${randomUUID()}@test.dev` } });

    const result = await orders!.processStripeEvent(unpaidEvent(user.id));

    expect(result).toMatchObject({ received: true, processed: false });
    expect(await prisma!.order.count()).toBe(0);
  });
});
