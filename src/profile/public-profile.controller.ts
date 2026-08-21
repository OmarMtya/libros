import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { PublicProfileService } from './public-profile.service';

@Controller('v1/public/profiles')
export class PublicProfileController {
  constructor(
    private readonly publicProfiles: PublicProfileService,
    private readonly auth: SupabaseAuthService,
  ) {}

  @Get(':slug/books')
  async books(
    @Param('slug') slug: string,
    @Query('category') category: string = 'enjoyed',
    @Query('offset') offset: string = '0',
    @Query('limit') limit: string = '50',
  ) {
    if (category !== 'enjoyed' && category !== 'notEnjoyed') return { books: [], offset: 0, limit: 50, total: 0, hasMore: false };
    return this.publicProfiles.getBooks(slug, category, Number(offset), Number(limit));
  }

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
