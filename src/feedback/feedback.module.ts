import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvidenceFactory } from '../profile/evidence.factory';
import { ProfileService } from '../profile/profile.service';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({ imports: [AuthModule], controllers: [FeedbackController], providers: [FeedbackService, ProfileService, EvidenceFactory] })
export class FeedbackModule {}
