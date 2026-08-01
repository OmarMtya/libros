import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersController, AdminOrdersController, PackagesController } from './orders.controller';
import { OrdersService } from './orders.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PackagesController, OrdersController, AdminOrdersController, StripeWebhookController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
