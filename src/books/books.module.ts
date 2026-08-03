import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [AuthModule],
  controllers: [BooksController, CatalogController],
  providers: [BooksService, CatalogService],
  exports: [BooksService, CatalogService],
})
export class BooksModule {}
