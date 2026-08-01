import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';
import { FeedbackContextResolver } from './feedback-context.resolver';
import { FeedbackInvitationService } from './feedback-invitation.service';
import { FeedbackLearningService } from './feedback-learning.service';
import { FeedbackPublicController } from './feedback-public.controller';
import { FeedbackTokenService } from './feedback-token.service';

@Module({
  imports: [AuthModule, ProfileModule],
  controllers: [FeedbackPublicController],
  providers: [FeedbackTokenService, FeedbackInvitationService, FeedbackContextResolver, FeedbackLearningService],
  exports: [FeedbackInvitationService],
})
export class FeedbackModule {}
