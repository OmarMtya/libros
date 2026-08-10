import { BadRequestException, Injectable } from '@nestjs/common';
import { FulfillmentStatus, OrderStatus, PaymentProvider, PaymentStatus, Prisma, ProductPackageKey } from '@prisma/client';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminOrderDto } from './admin-order.dto';

const PAYMENT_LINK_PREFIXES: Array<{ prefix: string; packageKey: ProductPackageKey }> = [
  { prefix: 'libro_sorpresa_fisico-', packageKey: 'libro_sorpresa_fisico' },
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async listPackages() {
    return this.prisma.productPackage.findMany({
      where: { isActive: true },
      select: { key: true, name: true, description: true, priceCents: true, shippingCents: true, currency: true, includedFormats: true },
      orderBy: { priceCents: 'asc' },
    });
  }

  async listOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      select: {
        id: true, packageKey: true, packageName: true, totalCents: true, currency: true, status: true, createdAt: true, paidAt: true,
        shippingAddress: true,
        fulfillment: {
          select: {
            status: true, bookTitle: true, bookAuthor: true, coverUrl: true, trackingNumber: true, shippedAt: true, deliveredAt: true,
            assignments: {
              where: { status: 'active' },
              select: {
                id: true,
                feedbackCycleStatus: true,
                edition: {
                  select: {
                    title: true,
                    book: {
                      select: {
                        canonicalTitle: true,
                        openLibraryCoverId: true,
                        authors: {
                          select: { author: { select: { canonicalName: true } } },
                          orderBy: { position: 'asc' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        _count: { select: { feedbacks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(({ fulfillment, ...order }) => {
      if (!fulfillment) return { ...order, fulfillment: null };
      const edition = fulfillment.assignments[0]?.edition ?? null;
      const book = edition?.book ?? null;
      const authors = (book?.authors ?? []).map(({ author }) => author.canonicalName);
      const delivered = fulfillment.status === FulfillmentStatus.delivered;
      return {
        ...order,
        fulfillment: {
          status: fulfillment.status,
          bookTitle: delivered ? (fulfillment.bookTitle ?? book?.canonicalTitle ?? edition?.title ?? null) : null,
          bookAuthor: delivered ? (fulfillment.bookAuthor ?? (authors.length > 0 ? authors.join(', ') : null)) : null,
          coverUrl: delivered ? (fulfillment.coverUrl ?? (book?.openLibraryCoverId != null ? `https://covers.openlibrary.org/b/id/${book.openLibraryCoverId}-L.jpg` : null)) : null,
          trackingNumber: fulfillment.trackingNumber,
          shippedAt: fulfillment.shippedAt,
          deliveredAt: fulfillment.deliveredAt,
          assignments: fulfillment.assignments.map(({ id, feedbackCycleStatus }) => ({ id, feedbackCycleStatus })),
        },
      };
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

  async createAdminOrder(dto: CreateAdminOrderDto) {
    const packageKey = dto.packageKey ?? 'libro_sorpresa_fisico';
    const eventId = `admin_${randomUUID()}`;
    const event = {
      id: eventId,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: eventId,
          client_reference_id: `${packageKey}-${dto.userId}`,
          payment_status: 'unpaid',
          amount_total: null,
          currency: null,
        },
      },
    } as unknown as Stripe.Event;
    return this.processStripeEvent(event, { allowFreeOrder: true });
  }

  async processStripeEvent(event: Stripe.Event, options?: { allowFreeOrder?: boolean }) {
    const session = event.data.object as Stripe.Checkout.Session;
    const allowFreeOrder = options?.allowFreeOrder ?? false;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.paymentEvent.create({
          data: {
            providerEventId: event.id,
            eventType: event.type,
            payload: event as unknown as Prisma.InputJsonValue,
          },
        });
        if (event.type !== 'checkout.session.completed') return { received: true, processed: false };
        if (allowFreeOrder && session.payment_status === 'paid') {
          throw new BadRequestException('Una orden administrativa no puede provenir de un pago realizado.');
        }
        if (!allowFreeOrder && (session.payment_status !== 'paid' || !session.amount_total)) return { received: true, processed: false };

        const { packageKey, userId } = this.parseClientReference(session.client_reference_id);
        const [product, user] = await Promise.all([
          tx.productPackage.findUnique({ where: { key: packageKey } }),
          tx.user.findUnique({ where: { id: userId } }),
        ]);
        if (!product?.isActive) throw new BadRequestException('El paquete de la compra no está disponible.');
        if (!user) throw new BadRequestException('El cliente de la compra no existe.');

        const currency = (session.currency ?? product.currency).toUpperCase();
        const shipping = allowFreeOrder ? undefined : this.extractShippingDetails(session);
        const order = await tx.order.create({
          data: {
            userId,
            packageId: product.id,
            packageKey: product.key,
            packageName: product.name,
            subtotalCents: allowFreeOrder ? 0 : product.priceCents,
            shippingCents: allowFreeOrder ? 0 : product.shippingCents,
            totalCents: allowFreeOrder ? 0 : session.amount_total ?? 0,
            currency,
            status: OrderStatus.curation_pending,
            paidAt: allowFreeOrder ? null : new Date(),
            shippingAddress: shipping ? { create: shipping } : undefined,
          },
        });
        let paymentId: string | null = null;
        if (!allowFreeOrder) {
          const payment = await tx.payment.create({
            data: {
              orderId: order.id,
              provider: PaymentProvider.stripe,
              externalSessionId: session.id,
              amountCents: session.amount_total ?? 0,
              currency,
              status: PaymentStatus.paid,
              providerPayload: session as unknown as Prisma.InputJsonValue,
            },
          });
          paymentId = payment.id;
        }
        if (paymentId) await tx.paymentEvent.update({ where: { providerEventId: event.id }, data: { paymentId } });
        await tx.fulfillment.create({
          data: {
            orderId: order.id,
            internalNotes: allowFreeOrder ? 'Orden administrativa sin cobro.' : undefined,
          },
        });
        const orderInfo = {
          orderId: order.id,
          orderRef: `LS-${order.id.slice(0, 8).toUpperCase()}`,
          customerName: user.displayName ?? user.email ?? 'Cliente',
          customerEmail: user.email ?? '',
          packageName: product.name,
          subtotalCents: order.subtotalCents,
          shippingCents: order.shippingCents,
          totalCents: order.totalCents,
          currency,
          address: shipping ? this.formatAddress(shipping) : null,
        };
        return {
          received: true,
          processed: true,
          orderInfo,
          confirmation: !allowFreeOrder && user.email
            ? {
                to: user.email,
                displayName: user.displayName,
                orderId: order.id,
                packageName: product.name,
                totalCents: order.totalCents,
                currency,
                address: shipping ? this.formatAddress(shipping) : null,
              }
            : null,
        };
      });

      if (result.processed && result.confirmation) await this.sendOrderConfirmation(result.confirmation);
      if (result.processed && result.orderInfo) await this.notifyAdminsOfNewOrder(result.orderInfo);
      const { confirmation: _confirmation, orderInfo: _orderInfo, ...response } = result;
      return response;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { received: true, duplicate: true };
      throw error;
    }
  }

  private async sendOrderConfirmation(info: {
    to: string;
    displayName: string | null;
    orderId: string;
    packageName: string;
    totalCents: number;
    currency: string;
    address: string | null;
  }): Promise<void> {
    const firstName = info.displayName?.split(' ')[0] || info.to.split('@')[0] || 'Lector';
    const orderRef = `LS-${info.orderId.slice(0, 8).toUpperCase()}`;
    const total = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(info.totalCents / 100);
    await this.email.send(
      'order-confirmation',
      info.to,
      {
        firstName,
        packageName: info.packageName,
        orderRef,
        totalLabel: `$${total} ${info.currency}`,
        address: info.address,
        trackUrl: this.trackUrl(),
      },
      `libros/order-confirmed/${info.orderId}`,
    );
  }

  private async notifyAdminsOfNewOrder(info: {
    orderId: string;
    orderRef: string;
    customerName: string;
    customerEmail: string;
    packageName: string;
    subtotalCents: number;
    shippingCents: number;
    totalCents: number;
    currency: string;
    address: string | null;
  }): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin', email: { not: null } },
      select: { email: true, displayName: true },
    });
    if (admins.length === 0) return;
    const formatAmount = (cents: number) =>
      `$${new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(cents / 100)} ${info.currency}`;
    const adminUrl = `${(process.env.APP_URL ?? 'http://localhost:4200').replace(/\/$/, '')}/app/admin`;
    for (const admin of admins) {
      if (!admin.email) continue;
      await this.email.send(
        'admin-order-notification',
        admin.email,
        {
          orderRef: info.orderRef,
          customerName: info.customerName,
          customerEmail: info.customerEmail,
          packageName: info.packageName,
          subtotalLabel: formatAmount(info.subtotalCents),
          shippingLabel: formatAmount(info.shippingCents),
          totalLabel: formatAmount(info.totalCents),
          address: info.address,
          adminUrl,
        },
        `libros/admin-order-notified/${info.orderId}/${admin.email}`,
      );
    }
  }

  private trackUrl(): string {
    const appUrl = process.env.APP_URL ?? 'http://localhost:4200';
    return `${appUrl.replace(/\/$/, '')}/app/mi-paquete`;
  }

  private formatAddress(address: { recipientName: string; street: string; interiorNumber?: string | null; city: string; state: string; postalCode: string }): string {
    const streetLine = [address.street, address.interiorNumber].filter(Boolean).join(' ');
    const cityLine = [address.city, address.state, address.postalCode].filter(Boolean).join(', ');
    return [address.recipientName, streetLine, cityLine].filter(Boolean).join(' · ');
  }

  private parseClientReference(reference: string | null) {
    const entry = PAYMENT_LINK_PREFIXES.find((candidate) => reference?.startsWith(candidate.prefix));
    if (!entry || !reference) throw new BadRequestException('La compra no incluye una referencia de cliente válida.');
    return { packageKey: entry.packageKey, userId: reference.slice(entry.prefix.length) };
  }

  private extractShippingDetails(session: Stripe.Checkout.Session) {
    const legacy = (session as unknown as { shipping_details?: { name?: string | null; phone?: string | null; address?: Stripe.Address | null } | null }).shipping_details;
    const modern = (session.collected_information?.shipping_details ?? undefined) as { name?: string | null; phone?: string | null; address?: Stripe.Address | null } | undefined;
    const details = legacy ?? modern;
    if (!details) return undefined;
    const address = details.address;
    return {
      recipientName: details.name ?? 'Cliente',
      phone: details.phone ?? session.customer_details?.phone ?? null,
      street: address?.line1 ?? '',
      interiorNumber: address?.line2 ?? null,
      city: address?.city ?? '',
      state: address?.state ?? '',
      postalCode: address?.postal_code ?? '',
      country: address?.country ? address.country.toUpperCase() : 'MX',
    };
  }
}
