import { Module } from '@nestjs/common';
import { DeepseekClient } from '../ai/deepseek.client';
import { AuthModule } from '../auth/auth.module';
import { EvidenceFactory } from './evidence.factory';
import { ProfileController } from './profile.controller';
import { ProfileDescriptionService } from './profile-description.service';
import { ProfileService } from './profile.service';
import { PublicProfileController } from './public-profile.controller';
import { PublicProfileService } from './public-profile.service';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController, PublicProfileController],
  providers: [
    ProfileService,
    EvidenceFactory,
    ProfileDescriptionService,
    PublicProfileService,
    { provide: DeepseekClient, useFactory: () => new DeepseekClient(process.env.DEEPSEEK_API_KEY ?? '') },
  ],
  exports: [ProfileService, EvidenceFactory, ProfileDescriptionService],
})
export class ProfileModule {}
