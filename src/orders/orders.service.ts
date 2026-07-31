import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentProvider, PaymentStatus, Prisma, ProductPackageKey } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutDto } from './orders.dto';

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
        fulfillment: { select: { status: true, bookTitle: true, bookAuthor: true, coverUrl: true, trackingNumber: true, ebookStoragePath: true, audioStoragePath: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCheckout(userId: string, dto: CreateCheckoutDto) {
    const [profile, product, user] = await Promise.all([
      this.prisma.readerProfile.findUnique({ where: { userId }, select: { readyToRecommend: true } }),
      this.prisma.productPackage.findUnique({ where: { key: dto.packageKey } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);
    if (!profile?.readyToRecommend) throw new BadRequestException('Completa tu cuestionario antes de elegir un paquete.');
    if (!product?.isActive || product.priceCents < 1) throw new NotFoundException('Este paquete no está disponible para compra.');
    if (product.currency !== 'MXN') throw new BadRequestException('El paquete no tiene una moneda válida.');
    const address = this.normalizeAddress(dto.shippingAddress);
    const totalCents = product.priceCents + product.shippingCents;
    const order = await this.prisma.order.create({
      data: {
        userId,
        packageId: product.id,
        packageKey: product.key,
        packageName: product.name,
        subtotalCents: product.priceCents,
        shippingCents: product.shippingCents,
        totalCents,
        currency: product.currency,
        shippingAddress: { create: address },
      },
    });
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: order.id,
        customer_email: user?.email ?? undefined,
        success_url: `${this.applicationUrl}/pago/exitoso?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.applicationUrl}/paquetes?cancelado=1`,
        metadata: { orderId: order.id },
        line_items: [{
          quantity: 1,
          price_data: {
            currency: product.currency.toLowerCase(),
            unit_amount: totalCents,
            product_data: { name: product.name, description: product.description },
          },
        }],
      }, { idempotencyKey: `order:${order.id}` });
      if (!session.url) throw new BadRequestException('No se pudo iniciar el pago. Intenta nuevamente.');
      await this.prisma.payment.create({
        data: { orderId: order.id, provider: PaymentProvider.stripe, externalSessionId: session.id, amountCents: totalCents, currency: product.currency },
      });
      return { orderId: order.id, checkoutUrl: session.url };
    } catch (error) {
      await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.cancelled } });
      throw error;
    }
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
        if (session.payment_status !== 'paid') return { received: true, processed: false };
        const payment = await tx.payment.findUnique({ where: { externalSessionId: session.id }, include: { order: true } });
        if (!payment) throw new NotFoundException('No se encontró el pago asociado.');
        const orderId = session.metadata?.orderId;
        if (session.client_reference_id !== payment.orderId || orderId !== payment.orderId || session.amount_total !== payment.amountCents || session.currency?.toUpperCase() !== payment.currency) {
          throw new BadRequestException('La confirmación de pago no coincide con el pedido.');
        }
        await tx.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.paid, providerPayload: session as unknown as Prisma.InputJsonValue } });
        await tx.paymentEvent.updateMany({ where: { providerEventId: event.id }, data: { paymentId: payment.id } });
        if (payment.order.status === OrderStatus.pending_payment) {
          await tx.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.curation_pending, paidAt: new Date() } });
          await tx.fulfillment.upsert({
            where: { orderId: payment.orderId },
            create: { orderId: payment.orderId },
            update: {},
          });
        }
        return { received: true, processed: true };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return { received: true, duplicate: true };
      throw error;
    }
  }

  private normalizeAddress(address: CreateCheckoutDto['shippingAddress']) {
    return {
      recipientName: address.recipientName.trim(),
      phone: address.phone.trim(),
      street: address.street.trim(),
      exteriorNumber: address.exteriorNumber.trim(),
      interiorNumber: address.interiorNumber?.trim() || null,
      neighborhood: address.neighborhood.trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      postalCode: address.postalCode,
      country: 'MX',
      references: address.references?.trim() || null,
    };
  }

  private get stripe() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new BadRequestException('Los pagos no están configurados.');
    return new Stripe(secretKey, { maxNetworkRetries: 2 });
  }

  private get applicationUrl() {
    const url = process.env.APP_URL;
    if (!url) throw new BadRequestException('La URL de la aplicación no está configurada.');
    return url.replace(/\/$/, '');
  }
}
