import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateAdminOrderDto } from './admin-order.dto';
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
}

@Controller('v1/admin/orders')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query('q') q?: string, @Query('status') status?: string, @Query('take') take?: string) {
    return this.orders.listAdminOrders(q, status, take);
  }

  @Post()
  create(@Body() dto: CreateAdminOrderDto) {
    return this.orders.createAdminOrder(dto);
  }
}
