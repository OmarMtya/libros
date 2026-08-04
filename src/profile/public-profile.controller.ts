import { Controller, Get, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { PublicProfileService } from './public-profile.service';

@Controller('v1/public/profiles')
export class PublicProfileController {
  constructor(
    private readonly publicProfiles: PublicProfileService,
    private readonly auth: SupabaseAuthService,
  ) {}

  @Get(':slug')
  async get(@Param('slug') slug: string, @Req() request: Request) {
    const user = await this.auth.tryAuthenticate(this.bearerToken(request));
    return this.publicProfiles.get(slug, user?.id ?? null);
  }

  private bearerToken(request: Request): string | undefined {
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    return scheme === 'Bearer' ? token : undefined;
  }
}
