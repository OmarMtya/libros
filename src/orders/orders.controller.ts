import { Body, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { OrdersService } from './orders.service';
import { CreateAdminOrderDto } from './dto/create-admin-order.dto';

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
  create(@Body() body: CreateAdminOrderDto) {
    return this.orders.createAdminOrder(body.userId, body.packageKey);
  }
}
