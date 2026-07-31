import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from './current-user.decorator';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { AuthenticatedUser } from './auth.types';

@Controller('v1/me')
@UseGuards(SupabaseAuthGuard)
export class MeController {
  @Get()
  getMe(@CurrentUser() user: AuthenticatedUser) { return user; }
}
