import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SubmitFeedbackDto } from './feedback.dto';
import { FeedbackService } from './feedback.service';

@Controller('v1/me/reading-feedback')
@UseGuards(SupabaseAuthGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  submit(@CurrentUser() user: AuthenticatedUser, @Body() dto: SubmitFeedbackDto) { return this.feedback.submit(user.id, dto); }
}
