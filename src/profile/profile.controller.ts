import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProfileService } from './profile.service';

@Controller('v1/me/reader-profile')
@UseGuards(SupabaseAuthGuard)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) { return this.profiles.getProfile(user.id); }

  @Get('versions')
  getVersions(@CurrentUser() user: AuthenticatedUser) { return this.profiles.getVersions(user.id); }

  @Get('diagnostics')
  getDiagnostics(@CurrentUser() user: AuthenticatedUser) { return this.profiles.getDiagnostics(user.id); }

  @Post('recompute')
  recompute(@CurrentUser() user: AuthenticatedUser) { return this.profiles.recompute(user.id, 'manual_recompute'); }
}
