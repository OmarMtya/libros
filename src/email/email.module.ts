import { Global, Module } from '@nestjs/common';
import { AdminNotificationsService } from './admin-notifications.service';
import { EmailService } from './email.service';
import { SupabaseEmailHookController } from './supabase-email-hook.controller';

@Global()
@Module({ controllers: [SupabaseEmailHookController], providers: [EmailService, AdminNotificationsService], exports: [EmailService, AdminNotificationsService] })
export class EmailModule {}
