import { BadRequestException, Injectable } from '@nestjs/common';
import { FulfillmentStatus, OrderStatus, PaymentProvider, PaymentStatus, Prisma, ProductPackageKey } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

const PAYMENT_LINK_PREFIXES: Array<{ prefix: string; packageKey: ProductPackageKey }> = [
  { prefix: 'libro_sorpresa_fisico-', packageKey: 'libro_sorpresa_fisico' },
  { prefix: 'libro_sorpresa_completo-', packageKey: 'libro_sorpresa_completo' },
];

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listPackages() {
    return this.prisma.productPackage.findMany({
      where: { isActive: true },
      select: { key: true, name: true, description: true, priceCents: true, shippingCents: true, currency: true, includedFormats: true },
      orderBy: { priceCents: 'asc' },
    });
  }

  async listOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      select: {
        id: true, packageKey: true, packageName: true, totalCents: true, currency: true, status: true, createdAt: true, paidAt: true,
        shippingAddress: true,
        fulfillment: {
          select: {
            status: true, bookTitle: true, bookAuthor: true, coverUrl: true, trackingNumber: true, shippedAt: true, deliveredAt: true,
            assignments: { where: { status: 'active' }, select: { id: true, feedbackCycleStatus: true } },
          },
        },
        _count: { select: { feedbacks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAdminOrders(q?: string, status?: string, take?: string) {
    const limit = Math.min(Math.max(Number(take) || 50, 1), 200);
    const search = q?.trim();
    const where: Prisma.OrderWhereInput = {};
    if (status) where.fulfillment = { is: { status: status as FulfillmentStatus } };
    if (search) {
      where.user = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }
    const orders = await this.prisma.order.findMany({
      where,
      select: {
        id: true, packageKey: true, packageName: true, subtotalCents: true, shippingCents: true, totalCents: true, currency: true,
        status: true, createdAt: true, paidAt: true,
        user: { select: { id: true, email: true, displayName: true } },
        shippingAddress: true,
        payments: { select: { status: true, amountCents: true, externalSessionId: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        fulfillment: { select: { id: true, status: true, trackingNumber: true, shippedAt: true, deliveredAt: true } },
        _count: { select: { feedbacks: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const fulfillmentIds = orders.flatMap((order) => (order.fulfillment ? [order.fulfillment.id] : []));
    const assignments = fulfillmentIds.length > 0
      ? await this.prisma.curationAssignment.findMany({
          where: { fulfillmentId: { in: fulfillmentIds }, status: 'active' },
          select: { id: true, feedbackCycleStatus: true, fulfillmentId: true },
        })
      : [];
    const assignmentByFulfillment = new Map(assignments.map((assignment) => [assignment.fulfillmentId, assignment]));
    return orders.map(({ payments, fulfillment, ...order }) => ({
      ...order,
      payment: payments[0] ?? null,
      fulfillment,
      activeAssignment: fulfillment ? assignmentByFulfillment.get(fulfillment.id) ?? null : null,
    }));
  }

  async processStripeEvent(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.paymentEvent.create({
          data: {
            providerEventId: event.id,
            eventType: event.type,
            payload: event as unknown as Prisma.InputJsonValue,
          },
        });
        if (event.type !== 'checkout.session.completed') return { received: true, processed: false };
        if (session.payment_status !== 'paid' || !session.amount_total) return { received: true, processed: false };

        const { packageKey, userId } = this.parseClientReference(session.client_reference_id);
        const [product, user] = await Promise.all([
          tx.productPackage.findUnique({ where: { key: packageKey } }),
          tx.user.findUnique({ where: { id: userId } }),
        ]);
        if (!product?.isActive) throw new BadRequestException('El paquete de la compra no está disponible.');
        if (!user) throw new BadRequestException('El cliente de la compra no existe.');

        const currency = (session.currency ?? product.currency).toUpperCase();
        const shipping = this.extractShippingDetails(session);
        const order = await tx.order.create({
          data: {
            userId,
            packageId: product.id,
            packageKey: product.key,
            packageName: product.name,
            subtotalCents: product.priceCents,
            shippingCents: product.shippingCents,
            totalCents: session.amount_total,
            currency,
            status: OrderStatus.curation_pending,
            paidAt: new Date(),
            shippingAddress: shipping ? { create: shipping } : undefined,
          },
        });
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            provider: PaymentProvider.stripe,
            externalSessionId: session.id,
            amountCents: session.amount_total,
            currency,
            status: PaymentStatus.paid,
            providerPayload: session as unknown as Prisma.InputJsonValue,
          },
        });
        await tx.paymentEvent.update({ where: { providerEventId: event.id }, data: { paymentId: payment.id } });
        await tx.fulfillment.create({ data: { orderId: order.id } });
        return { received: true, processed: true };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { received: true, duplicate: true };
      throw error;
    }
  }

  private parseClientReference(reference: string | null) {
    const entry = PAYMENT_LINK_PREFIXES.find((candidate) => reference?.startsWith(candidate.prefix));
    if (!entry || !reference) throw new BadRequestException('La compra no incluye una referencia de cliente válida.');
    return { packageKey: entry.packageKey, userId: reference.slice(entry.prefix.length) };
  }

  private extractShippingDetails(session: Stripe.Checkout.Session) {
    const legacy = (session as unknown as { shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null }).shipping_details;
    const modern = session.collected_information?.shipping_details;
    const details = legacy ?? modern;
    if (!details) return undefined;
    const address = details.address;
    return {
      recipientName: details.name ?? 'Cliente',
      street: address?.line1 ?? '',
      interiorNumber: address?.line2 ?? null,
      city: address?.city ?? '',
      state: address?.state ?? '',
      postalCode: address?.postal_code ?? '',
      country: address?.country ? address.country.toUpperCase() : 'MX',
    };
  }
}
