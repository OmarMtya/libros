import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SubmitFeedbackByTokenDto } from './feedback.dto';
import { FeedbackTokenService } from './feedback-token.service';

@Controller('v1/feedback')
export class FeedbackPublicController {
  constructor(
    private readonly tokenService: FeedbackTokenService,
    private readonly auth: SupabaseAuthService,
  ) {}

  @Get(':token')
  async get(@Param('token') token: string) {
    return this.tokenService.resolveInvitation(token);
  }

  @Post(':token')
  async submit(@Param('token') token: string, @Body() dto: SubmitFeedbackByTokenDto, @Req() request: Request) {
    const user = await this.auth.tryAuthenticate(this.bearerToken(request));
    return this.tokenService.submitByToken(token, dto, user?.id ?? null);
  }

  private bearerToken(request: Request): string | undefined {
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    return scheme === 'Bearer' ? token : undefined;
  }
}
