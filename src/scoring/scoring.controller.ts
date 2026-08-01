import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ScoringService } from './scoring.service';

@Controller('v1/admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Post('fulfillments/:id/score')
  score(@Param('id', ParseUUIDPipe) fulfillmentId: string) {
    return this.scoring.scoreForFulfillment(fulfillmentId);
  }
}
