import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BooksModule } from '../books/books.module';
import { AiClassificationController } from './ai-classification.controller';
import { AiClassificationJobsService } from './ai-classification-jobs.service';
import { AiClassificationWorker } from './ai-classification.worker';
import { BookClassificationAiService } from './book-classification-ai.service';
import { BookContextService } from './book-context.service';
import { DeepseekClient } from './deepseek.client';

@Module({
  imports: [AuthModule, BooksModule],
  controllers: [AiClassificationController],
  providers: [
    BookClassificationAiService,
    BookContextService,
    AiClassificationJobsService,
    AiClassificationWorker,
    { provide: DeepseekClient, useFactory: () => new DeepseekClient(process.env.DEEPSEEK_API_KEY ?? '') },
  ],
})
export class AiModule {}
