import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminGuard } from './admin.guard';
import { MeController } from './me.controller';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseAuthService } from './supabase-auth.service';

@Module({
  imports: [PrismaModule],
  controllers: [MeController],
  providers: [SupabaseAuthService, SupabaseAuthGuard, AdminGuard],
  exports: [SupabaseAuthService, SupabaseAuthGuard, AdminGuard],
})
export class AuthModule {}
