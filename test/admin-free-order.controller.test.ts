import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AdminGuard } from '../src/auth/admin.guard';
import { SupabaseAuthGuard } from '../src/auth/supabase-auth.guard';
import { AdminOrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';

function contextWithUser(user: { role?: string } | null) {
  const request = { user: user ?? null };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as Parameters<AdminGuard['canActivate']>[0];
}

describe('Orden administrativa gratuita (controller)', () => {
  it('AdminGuard permite a un admin', () => {
    const guard = new AdminGuard();
    expect(guard.canActivate(contextWithUser({ role: UserRole.admin }))).toBe(true);
  });

  it('AdminGuard rechaza a un cliente', () => {
    const guard = new AdminGuard();
    expect(() => guard.canActivate(contextWithUser({ role: UserRole.customer }))).toThrow(ForbiddenException);
  });

  it('AdminGuard rechaza a un usuario anónimo', () => {
    const guard = new AdminGuard();
    expect(() => guard.canActivate(contextWithUser(null))).toThrow(ForbiddenException);
  });

  it('AdminOrdersController está protegido con SupabaseAuthGuard y AdminGuard', () => {
    const guards = Reflect.getMetadata('__guards__', AdminOrdersController) ?? [];
    expect(guards).toContain(SupabaseAuthGuard);
    expect(guards).toContain(AdminGuard);
  });

  it('el POST delega en OrdersService.createAdminOrder con el DTO', async () => {
    const orders = { createAdminOrder: vi.fn().mockResolvedValue({ received: true, processed: true }) } as unknown as OrdersService;
    const controller = new AdminOrdersController(orders);
    const dto = { userId: '11111111-1111-1111-1111-111111111111' };
    const result = await controller.create(dto as never);
    expect(orders.createAdminOrder).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ received: true, processed: true });
  });
});
