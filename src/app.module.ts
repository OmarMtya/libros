import { Module } from '@nestjs/common';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { BooksModule } from './books/books.module';
import { CurationModule } from './curation/curation.module';
import { EmailModule } from './email/email.module';
import { FeedbackModule } from './feedback/feedback.module';
import { MetaModule } from './meta/meta.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { QuestionnaireModule } from './questionnaire/questionnaire.module';
import { TagsModule } from './tags/tags.module';
import { OrdersModule } from './orders/orders.module';
import { ScoringModule } from './scoring/scoring.module';

const sentryEnabled = process.env.NODE_ENV === 'production' && Boolean(process.env.SENTRY_DSN);

@Module({
  imports: [
    ...(sentryEnabled ? [SentryModule.forRoot()] : []),
    PrismaModule,
    AiModule,
    AuthModule,
    AdminModule,
    BooksModule,
    TagsModule,
    ProfileModule,
    QuestionnaireModule,
    FeedbackModule,
    CurationModule,
    OrdersModule,
    ScoringModule,
    EmailModule,
    MetaModule,
  ],
  providers: sentryEnabled ? [{ provide: APP_FILTER, useClass: SentryGlobalFilter }] : [],
})
export class AppModule {}
