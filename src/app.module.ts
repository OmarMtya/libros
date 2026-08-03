import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { BooksModule } from './books/books.module';
import { CurationModule } from './curation/curation.module';
import { EmailModule } from './email/email.module';
import { FeedbackModule } from './feedback/feedback.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { QuestionnaireModule } from './questionnaire/questionnaire.module';
import { TagsModule } from './tags/tags.module';
import { OrdersModule } from './orders/orders.module';
import { ScoringModule } from './scoring/scoring.module';

@Module({ imports: [PrismaModule, AiModule, AuthModule, AdminModule, BooksModule, TagsModule, ProfileModule, QuestionnaireModule, FeedbackModule, CurationModule, OrdersModule, ScoringModule, EmailModule] })
export class AppModule {}
