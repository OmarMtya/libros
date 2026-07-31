import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';

@Module({ imports: [AuthModule, PrismaModule], controllers: [AdminController] })
export class AdminModule {}
