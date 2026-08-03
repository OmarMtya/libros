import { Global, Module } from '@nestjs/common';
import { AdminNotificationsService } from './admin-notifications.service';
import { EmailService } from './email.service';

@Global()
@Module({ providers: [EmailService, AdminNotificationsService], exports: [EmailService, AdminNotificationsService] })
export class EmailModule {}
