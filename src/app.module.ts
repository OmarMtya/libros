import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { BooksModule } from './books/books.module';
import { FeedbackModule } from './feedback/feedback.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { QuestionnaireModule } from './questionnaire/questionnaire.module';
import { TagsModule } from './tags/tags.module';
import { OrdersModule } from './orders/orders.module';

@Module({ imports: [PrismaModule, AuthModule, AdminModule, BooksModule, TagsModule, ProfileModule, QuestionnaireModule, FeedbackModule, OrdersModule] })
export class AppModule {}
