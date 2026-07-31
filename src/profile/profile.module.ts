import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EvidenceFactory } from './evidence.factory';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({ imports: [AuthModule], controllers: [ProfileController], providers: [ProfileService, EvidenceFactory], exports: [ProfileService, EvidenceFactory] })
export class ProfileModule {}
