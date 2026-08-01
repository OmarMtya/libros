import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProfileModule } from '../profile/profile.module';
import { ScoringController } from './scoring.controller';
import { ScoringService } from './scoring.service';

@Module({
  imports: [AuthModule, ProfileModule],
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
