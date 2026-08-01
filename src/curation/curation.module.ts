import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FeedbackInvitationService } from '../feedback/feedback-invitation.service';
import { ProfileModule } from '../profile/profile.module';
import { CurationController } from './curation.controller';
import { CurationService } from './curation.service';
import { CuratorAuditService } from './curator-audit.service';

@Module({
  imports: [AuthModule, ProfileModule],
  controllers: [CurationController],
  providers: [CurationService, FeedbackInvitationService, CuratorAuditService],
  exports: [CurationService, CuratorAuditService],
})
export class CurationModule {}
