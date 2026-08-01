import { BadRequestException, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';
import { OrdersService } from './orders.service';

type StripeRequest = Request & { rawBody?: Buffer };

@Controller('v1/webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(200)
  async receive(@Req() request: StripeRequest, @Headers('stripe-signature') signature?: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !secret || !request.rawBody) throw new BadRequestException('No se pudo verificar la notificación de pago.');
    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(request.rawBody, signature, secret);
    } catch {
      throw new BadRequestException('La firma de la notificación no es válida.');
    }
    return this.orders.processStripeEvent(event);
  }
}
