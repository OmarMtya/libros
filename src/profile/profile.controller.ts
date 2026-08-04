import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
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

  @Patch('avatar')
  async updateAvatar(@CurrentUser() user: AuthenticatedUser, @Body() body: { url?: string }) {
    const url = typeof body?.url === 'string' ? body.url.trim().slice(0, 2048) : null;
    await this.prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url || null } });
    return { avatarUrl: url || null };
  }
}
