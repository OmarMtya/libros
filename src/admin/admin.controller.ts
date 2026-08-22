import { Prisma } from '@prisma/client';
import { BadRequestException, ConflictException, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { EmailService } from '../email/email.service';
import { renderEmail } from '../email/email-templates';
import { PrismaService } from '../prisma/prisma.service';

@Controller('v1/admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Get('users')
  async listUsers(@Query('q') q?: string, @Query('take') take?: string) {
    const limit = Math.min(Math.max(Number(take) || 25, 1), 100);
    const search = q?.trim();
    const users = await this.prisma.user.findMany({
      where: search ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { displayName: { contains: search, mode: 'insensitive' } }] } : undefined,
      select: {
        id: true, email: true, displayName: true, role: true, createdAt: true,
        readerProfile: { select: { publicSlug: true, readyToRecommend: true, goodreadsUrl: true, currentVersion: true, updatedAt: true, snapshotJson: true } },
        _count: { select: { orders: true, readingFeedback: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return users.map(({ readerProfile, ...user }) => ({
      ...user,
      readerProfile: readerProfile ? {
        publicSlug: readerProfile.publicSlug,
        readyToRecommend: readerProfile.readyToRecommend,
        goodreadsUrl: readerProfile.goodreadsUrl,
        currentVersion: readerProfile.currentVersion,
        updatedAt: readerProfile.updatedAt,
        goodreadsImport: this.goodreadsImportSummary(readerProfile.snapshotJson),
        goodreadsImportCompletedAt: this.goodreadsImportCompletedAt(readerProfile.snapshotJson),
      } : null,
    }));
  }

  @Post('users/:userId/goodreads-import-complete')
  async completeGoodreadsImport(@Param('userId') userId: string) {
    const profile = await this.prisma.readerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        publicSlug: true,
        snapshotJson: true,
        optimisticLockVersion: true,
        user: { select: { email: true, displayName: true } },
      },
    });
    if (!profile) throw new NotFoundException('No se encontró el perfil lector.');

    const snapshot = profile.snapshotJson && typeof profile.snapshotJson === 'object' && !Array.isArray(profile.snapshotJson)
      ? profile.snapshotJson as Record<string, unknown>
      : {};
    const existingCompletedAt = this.goodreadsImportCompletedAt(snapshot);
    if (existingCompletedAt) return { completed: true, alreadyCompleted: true, completedAt: existingCompletedAt, emailSent: true };
    if (!profile.user.email) throw new BadRequestException('El lector no tiene un correo electrónico registrado.');
    if (!profile.publicSlug) throw new BadRequestException('El perfil lector no tiene un enlace público.');

    const completedAt = new Date().toISOString();
    const imported = this.goodreadsImportSummary(snapshot);
    const library = Array.isArray(snapshot.goodreads_library) ? snapshot.goodreads_library : [];
    const importedCount = imported?.importedCount ?? library.length;
    const enjoyedCount = imported?.enjoyedCount ?? library.filter((book) => this.goodreadsCategory(book) === 'enjoyed').length;
    const notEnjoyedCount = imported?.notEnjoyedCount ?? library.filter((book) => this.goodreadsCategory(book) === 'notEnjoyed').length;
    const rendered = renderEmail('goodreads-imported', {
      firstName: profile.user.displayName?.trim() || profile.user.email.split('@')[0] || 'lector',
      importedCount,
      enjoyedCount,
      notEnjoyedCount,
      profileUrl: `${(process.env.APP_URL ?? 'http://localhost:4200').replace(/\/$/, '')}/perfil/${profile.publicSlug}`,
    });
    const sent = await this.email.sendRendered(profile.user.email, rendered, `libros/goodreads-imported/${userId}`);
    if (!sent) throw new ConflictException('El correo no pudo enviarse; la importación no se marcó como terminada.');

    const updated = await this.prisma.readerProfile.updateMany({
      where: { id: profile.id, optimisticLockVersion: profile.optimisticLockVersion },
      data: {
        snapshotJson: { ...snapshot, goodreads_import_completed_at: completedAt } as Prisma.InputJsonValue,
        optimisticLockVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new ConflictException('El perfil cambió mientras se marcaba la importación. Vuelve a intentarlo.');
    return { completed: true, alreadyCompleted: false, completedAt, emailSent: true };
  }

  private goodreadsImportSummary(snapshotJson: unknown): { importedAt: string; importedCount: number; enjoyedCount: number; notEnjoyedCount: number } | null {
    if (!snapshotJson || typeof snapshotJson !== 'object' || Array.isArray(snapshotJson)) return null;
    const imported = (snapshotJson as Record<string, unknown>).goodreads_import;
    if (!imported || typeof imported !== 'object' || Array.isArray(imported)) return null;
    const value = imported as Record<string, unknown>;
    if (typeof value.imported_at !== 'string') return null;
    return {
      importedAt: value.imported_at,
      importedCount: typeof value.imported_count === 'number' ? value.imported_count : 0,
      enjoyedCount: typeof value.enjoyed_count === 'number' ? value.enjoyed_count : 0,
      notEnjoyedCount: typeof value.not_enjoyed_count === 'number' ? value.not_enjoyed_count : 0,
    };
  }

  private goodreadsImportCompletedAt(snapshotJson: unknown): string | null {
    if (!snapshotJson || typeof snapshotJson !== 'object' || Array.isArray(snapshotJson)) return null;
    const value = (snapshotJson as Record<string, unknown>).goodreads_import_completed_at;
    return typeof value === 'string' && value ? value : null;
  }

  private goodreadsCategory(book: unknown): 'enjoyed' | 'notEnjoyed' | null {
    if (!book || typeof book !== 'object' || Array.isArray(book)) return null;
    const rating = (book as Record<string, unknown>).rating;
    if (typeof rating !== 'number') return null;
    return rating >= 3 ? 'enjoyed' : 'notEnjoyed';
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
