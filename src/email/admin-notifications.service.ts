import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

const READING_STATUS_LABELS: Record<string, string> = {
  completed: 'Completó la lectura',
  in_progress: 'En progreso',
  paused: 'En pausa',
  abandoned: 'Abandonó',
  not_started: 'No lo empezó',
};

type AdminRecipient = { email: string | null; displayName: string | null };

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async notifyNewReader(userId: string): Promise<void> {
    await this.run('nuevo lector', async (recipients) => {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true } });
      if (!user?.email) return;
      const readerName = user.displayName ?? user.email;
      for (const admin of recipients) {
        if (!admin.email) continue;
        await this.email.send(
          'admin-new-reader',
          admin.email,
          { readerName, readerEmail: user.email, readerUrl: this.readerUrl(userId) },
          `libros/admin-new-reader/${userId}/${admin.email}`,
        );
      }
    });
  }

  async notifyNewFeedback(info: {
    feedbackId: string;
    userId: string;
    bookTitle: string;
    readingStatus: string;
    selectionFitRating: number | null;
    freeText: string | null;
  }): Promise<void> {
    await this.run('feedback', async (recipients) => {
      const user = await this.prisma.user.findUnique({ where: { id: info.userId }, select: { email: true, displayName: true } });
      if (!user?.email) return;
      const readerName = user.displayName ?? user.email;
      for (const admin of recipients) {
        if (!admin.email) continue;
        await this.email.send(
          'admin-feedback-notification',
          admin.email,
          {
            readerName,
            readerEmail: user.email,
            bookTitle: info.bookTitle,
            readingStatusLabel: READING_STATUS_LABELS[info.readingStatus] ?? info.readingStatus,
            ratingLabel: info.selectionFitRating != null ? `${info.selectionFitRating} de 5` : 'Sin calificar',
            comment: info.freeText,
            adminUrl: this.adminUrl(),
          },
          `libros/admin-feedback/${info.feedbackId}/${admin.email}`,
        );
      }
    });
  }

  private async run(description: string, operation: (recipients: AdminRecipient[]) => Promise<void>): Promise<void> {
    try {
      const recipients = await this.prisma.user.findMany({
        where: { role: 'admin', email: { not: null } },
        select: { email: true, displayName: true },
      });
      if (recipients.length === 0) return;
      await operation(recipients);
    } catch (error) {
      this.logger.error(`Fallo al notificar admins (${description}):`, error instanceof Error ? error.stack : error);
    }
  }

  private adminUrl(): string {
    return `${(process.env.APP_URL ?? 'http://localhost:4200').replace(/\/$/, '')}/app/admin`;
  }

  private readerUrl(userId: string): string {
    return `${(process.env.APP_URL ?? 'http://localhost:4200').replace(/\/$/, '')}/app/lectores?userId=${userId}`;
  }
}
