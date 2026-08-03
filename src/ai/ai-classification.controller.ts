import { BadRequestException, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminGuard } from '../auth/admin.guard';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AiClassificationJobsService } from './ai-classification-jobs.service';
import { pdfToMarkdown } from './pdf-to-markdown';

export type UploadedPdf = { buffer: Buffer; originalname?: string; mimetype?: string; size?: number };

const MAX_PDF_BYTES = 30 * 1024 * 1024;

@Controller('v1/admin/classifications')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AiClassificationController {
  constructor(
    private readonly jobs: AiClassificationJobsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':id/ai-propose-pdf')
  @UseInterceptors(
    FileInterceptor('pdf', {
      limits: { fileSize: MAX_PDF_BYTES },
      fileFilter: (_request, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          callback(new BadRequestException('El archivo debe ser un PDF.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async proposeFromPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) classificationId: string,
    @UploadedFile() file: UploadedPdf | undefined,
  ) {
    if (!file?.buffer) throw new BadRequestException('Falta el archivo PDF.');
    await this.assertEditableDraft(classificationId);
    const { markdown } = pdfToMarkdown(file.buffer);
    return this.jobs.create(user.id, classificationId, markdown);
  }

  @Get('ai-jobs/:jobId')
  getJob(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.jobs.get(jobId);
  }

  @Get(':id/ai-job')
  latestActive(@Param('id', ParseUUIDPipe) classificationId: string) {
    return this.jobs.latestActive(classificationId);
  }

  private async assertEditableDraft(classificationId: string) {
    const classification = await this.prisma.bookClassificationVersion.findUnique({
      where: { id: classificationId },
      select: { status: true },
    });
    if (!classification) throw new NotFoundException('No se encontró la clasificación.');
    if (classification.status !== 'draft') {
      throw new BadRequestException('La clasificación debe estar en borrador para proponer valores con IA.');
    }
  }
}
