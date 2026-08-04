import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvidenceFactory } from '../profile/evidence.factory';
import { ProfileModule } from '../profile/profile.module';
import { ProfileService } from '../profile/profile.service';
import { QuestionnaireController } from './questionnaire.controller';
import { QuestionnaireService } from './questionnaire.service';

@Module({
  imports: [AuthModule, ProfileModule],
  controllers: [QuestionnaireController],
  providers: [QuestionnaireService, ProfileService, EvidenceFactory],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
