import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateCheckoutDto } from './orders.dto';
import { OrdersService } from './orders.service';

@Controller('v1/packages')
export class PackagesController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list() { return this.orders.listPackages(); }
}

@Controller('v1/orders')
@UseGuards(SupabaseAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.orders.listOrders(user.id); }

  @Post('checkout')
  checkout(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCheckoutDto) { return this.orders.createCheckout(user.id, dto); }
}
