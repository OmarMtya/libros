import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SubmitAnswerDto } from './questionnaire.dto';
import { QuestionnaireService } from './questionnaire.service';

@Controller('v1/questionnaire-sessions')
@UseGuards(SupabaseAuthGuard)
export class QuestionnaireController {
  constructor(private readonly questionnaires: QuestionnaireService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.questionnaires.listSessions(user.id); }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser) { return this.questionnaires.createSession(user.id); }

  @Post('reset')
  reset(@CurrentUser() user: AuthenticatedUser) { return this.questionnaires.reset(user.id); }

  @Get(':id/next-question')
  nextQuestion(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.questionnaires.nextQuestion(id, user.id); }

  @Get(':id/questions/:questionKey')
  questionWithResponse(@Param('id') id: string, @Param('questionKey') questionKey: string, @CurrentUser() user: AuthenticatedUser) { return this.questionnaires.getQuestionWithResponse(id, questionKey, user.id); }

  @Post(':id/answers/:questionKey')
  answer(@Param('id') id: string, @Param('questionKey') questionKey: string, @Body() dto: SubmitAnswerDto, @CurrentUser() user: AuthenticatedUser) { return this.questionnaires.submitAnswer(id, questionKey, dto, user.id); }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.questionnaires.completeSession(id, user.id); }
}
