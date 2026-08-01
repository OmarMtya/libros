import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateBookDto, CreateClassificationDraftDto, CreateClassificationDto, CreateEditionDto, SaveClassificationDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

@Controller('v1/admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('books')
  listBooks(@Query('q') q?: string) {
    return this.catalog.listBooks(q);
  }

  @Get('books/:id')
  getBook(@Param('id', ParseUUIDPipe) bookId: string) {
    return this.catalog.getBook(bookId);
  }

  @Get('catalog/features')
  featureTemplate(@Query('contentTypeKey') contentTypeKey: string, @Query('contentTypeSchemaVersion') contentTypeSchemaVersion: string, @Query('featureSchemaVersion') featureSchemaVersion: string) {
    return this.catalog.featureTemplate(contentTypeKey, contentTypeSchemaVersion, featureSchemaVersion);
  }

  @Post('books')
  createBook(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookDto) {
    return this.catalog.createBook(user.id, dto);
  }

  @Delete('books/:id')
  deleteBook(@Param('id', ParseUUIDPipe) bookId: string) {
    return this.catalog.deleteBook(bookId);
  }

  @Post('books/:id/editions')
  addEdition(@Param('id', ParseUUIDPipe) bookId: string, @Body() dto: CreateEditionDto) {
    return this.catalog.addEdition(bookId, dto);
  }

  @Post('editions/:id/classifications')
  createClassification(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) editionId: string, @Body() dto: CreateClassificationDto) {
    return this.catalog.createClassification(user.id, editionId, dto);
  }

  @Post('editions/:id/classifications/draft')
  createClassificationDraft(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) editionId: string, @Body() dto: CreateClassificationDraftDto) {
    return this.catalog.getOrCreateDraft(user.id, editionId, dto);
  }

  @Get('classifications/:id/editor')
  classificationEditor(@Param('id', ParseUUIDPipe) classificationId: string) {
    return this.catalog.getEditor(classificationId);
  }

  @Put('classifications/:id')
  saveClassification(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) classificationId: string, @Body() dto: SaveClassificationDto) {
    return this.catalog.saveDraft(user.id, classificationId, dto);
  }

  @Post('classifications/:id/correct')
  correctClassification(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) classificationId: string) {
    return this.catalog.correct(user.id, classificationId);
  }

  @Get('classifications/:id/diagnostics')
  diagnostics(@Param('id', ParseUUIDPipe) classificationId: string) {
    return this.catalog.diagnostics(classificationId);
  }

  @Post('classifications/:id/approve')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) classificationId: string) {
    return this.catalog.approve(user.id, classificationId);
  }
}
