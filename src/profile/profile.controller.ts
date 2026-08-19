import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileDescriptionService } from './profile-description.service';
import { ProfileService } from './profile.service';

@Controller('v1/me/reader-profile')
@UseGuards(SupabaseAuthGuard)
export class ProfileController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly descriptions: ProfileDescriptionService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.profiles.getProfile(user.id);
    void this.descriptions.ensureGeneration(user.id);
    return profile;
  }

  @Get('versions')
  getVersions(@CurrentUser() user: AuthenticatedUser) { return this.profiles.getVersions(user.id); }

  @Get('diagnostics')
  getDiagnostics(@CurrentUser() user: AuthenticatedUser) { return this.profiles.getDiagnostics(user.id); }

  @Post('recompute')
  recompute(@CurrentUser() user: AuthenticatedUser) { return this.profiles.recompute(user.id, 'manual_recompute'); }

  @Post('regenerate-description')
  regenerateDescription(@CurrentUser() user: AuthenticatedUser) { return this.descriptions.generateNow(user.id); }

  @Post('books')
  addBooks(@CurrentUser() user: AuthenticatedUser, @Body() body: { books?: unknown[] }) {
    return this.profiles.addSupplementalBooks(user.id, body?.books);
  }

  @Delete('books/:openLibraryId')
  removeBook(@CurrentUser() user: AuthenticatedUser, @Param('openLibraryId') openLibraryId: string) {
    return this.profiles.removeSupplementalBook(user.id, openLibraryId);
  }

  @Patch('avatar')
  async updateAvatar(@CurrentUser() user: AuthenticatedUser, @Body() body: { url?: string }) {
    const url = typeof body?.url === 'string' ? body.url.trim().slice(0, 2048) : null;
    await this.prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url || null } });
    return { avatarUrl: url || null };
  }

  @Patch('goodreads')
  async updateGoodreads(@CurrentUser() user: AuthenticatedUser, @Body() body: { url?: string }) {
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    const normalized = this.normalizeGoodreadsUrl(url);
    await this.profiles.ensureProfile(user.id);
    await this.prisma.readerProfile.update({ where: { userId: user.id }, data: { goodreadsUrl: normalized } });
    return { goodreadsUrl: normalized };
  }

  private normalizeGoodreadsUrl(value: string): string | null {
    if (!value) return null;
    if (value.length > 2048) throw new BadRequestException('La URL de Goodreads es demasiado larga.');
    const trimmed = value.replace(/\/+$/, '');
    if (!/^https?:\/\/(www\.)?goodreads\.com\/user\/show\/\d+(?:[/?#-]|$)/i.test(trimmed)) {
      throw new BadRequestException('Ingresa una URL válida de un perfil de Goodreads (ej. https://www.goodreads.com/user/show/12345).');
    }
    return trimmed;
  }
}
