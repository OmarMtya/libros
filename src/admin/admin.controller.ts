import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  async listUsers(@Query('q') q?: string, @Query('take') take?: string) {
    const limit = Math.min(Math.max(Number(take) || 25, 1), 100);
    const search = q?.trim();
    return this.prisma.user.findMany({
      where: search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { displayName: { contains: search, mode: 'insensitive' } }] } : undefined,
      select: {
        id: true, email: true, displayName: true, role: true, createdAt: true,
        readerProfile: { select: { publicSlug: true, readyToRecommend: true, currentVersion: true, updatedAt: true } },
        _count: { select: { orders: true, readingFeedback: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  @Get('users/:userId')
  async getUser(@Param('userId') userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        readerProfile: {
          include: {
            dimensions: { orderBy: { dimensionKey: 'asc' } }, tagPreferences: { orderBy: { tagKey: 'asc' } }, operationalConstraints: true,
            conditionalRules: true, positiveTriggers: { include: { evidence: true } }, evidence: { orderBy: { createdAt: 'asc' } },
          },
        },
        questionnaireSessions: { orderBy: { startedAt: 'desc' }, include: { answers: { orderBy: { answeredAt: 'asc' } } } },
        readingFeedback: { orderBy: { submittedAt: 'desc' }, include: { aspects: true } },
        orders: { orderBy: { createdAt: 'desc' }, include: { shippingAddress: true, payments: true, fulfillment: true } },
      },
    });
    if (!user) throw new NotFoundException('No se encontró la persona solicitada.');
    return user;
  }
}
