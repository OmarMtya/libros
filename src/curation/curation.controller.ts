import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AssignDto, ReplaceDto, ReopenLearningDto, ShipDto } from './curation.dto';
import { CurationService } from './curation.service';

@Controller('v1/admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class CurationController {
  constructor(private readonly curation: CurationService) {}

  @Get('fulfillments')
  listFulfillments(@Query('status') status?: string) {
    return this.curation.listFulfillments(status);
  }

  @Post('fulfillments/:id/assignments')
  assign(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) fulfillmentId: string, @Body() dto: AssignDto) {
    return this.curation.assign(user.id, fulfillmentId, dto);
  }

  @Post('assignments/:id/replace')
  replace(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) assignmentId: string, @Body() dto: ReplaceDto) {
    return this.curation.replace(user.id, assignmentId, dto);
  }

  @Post('assignments/:id/pack')
  pack(@Param('id', ParseUUIDPipe) assignmentId: string) {
    return this.curation.pack(assignmentId);
  }

  @Post('assignments/:id/ship')
  ship(@Param('id', ParseUUIDPipe) assignmentId: string, @Body() dto: ShipDto) {
    return this.curation.ship(assignmentId, dto);
  }

  @Post('assignments/:id/tracking')
  updateTracking(@Param('id', ParseUUIDPipe) assignmentId: string, @Body() dto: ShipDto) {
    return this.curation.updateTracking(assignmentId, dto);
  }

  @Post('assignments/:id/in-delivery')
  startDelivery(@Param('id', ParseUUIDPipe) assignmentId: string) {
    return this.curation.startDelivery(assignmentId);
  }

  @Post('assignments/:id/delivered')
  delivered(@Param('id', ParseUUIDPipe) assignmentId: string) {
    return this.curation.delivered(assignmentId);
  }

  @Post('assignments/:id/unpack')
  unpack(@Param('id', ParseUUIDPipe) assignmentId: string) {
    return this.curation.unpack(assignmentId);
  }

  @Post('assignments/:id/unship')
  unship(@Param('id', ParseUUIDPipe) assignmentId: string) {
    return this.curation.unship(assignmentId);
  }

  @Post('assignments/:id/undo-in-delivery')
  undoInDelivery(@Param('id', ParseUUIDPipe) assignmentId: string) {
    return this.curation.undoInDelivery(assignmentId);
  }

  @Post('assignments/:id/undo-delivered')
  undoDelivered(@Param('id', ParseUUIDPipe) assignmentId: string) {
    return this.curation.undoDelivered(assignmentId);
  }

  @Post('assignments/:id/close-without-feedback')
  closeWithoutFeedback(@Param('id', ParseUUIDPipe) assignmentId: string) {
    return this.curation.closeWithoutFeedback(assignmentId);
  }

  @Post('assignments/:id/reissue-invitation')
  reissueInvitation(@Param('id', ParseUUIDPipe) assignmentId: string) {
    return this.curation.reissueInvitation(assignmentId);
  }

  @Post('assignments/:id/reopen-learning')
  reopenLearning(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) assignmentId: string, @Body() dto: ReopenLearningDto) {
    return this.curation.reopenLearning(user.id, assignmentId, dto.reason);
  }

  @Get('assignments')
  listAssignments(@Query('fulfillmentId') fulfillmentId?: string) {
    return this.curation.listAssignments(fulfillmentId);
  }
}
