import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CatalogService } from '../books/catalog.service';
import { SaveClassificationDto } from '../books/catalog.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AiProposal, BookClassificationAiService } from './book-classification-ai.service';

export type AiJobStatus = 'pending' | 'processing' | 'done' | 'failed';
export type AiJobView = { id: string; status: AiJobStatus; error: string | null };

const ACTIVE_STATUSES: AiJobStatus[] = ['pending', 'processing'];

@Injectable()
export class AiClassificationJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: BookClassificationAiService,
    private readonly catalog: CatalogService,
  ) {}

  async create(actorId: string, classificationId: string, sourceMarkdown: string): Promise<{ jobId: string }> {
    const active = await this.prisma.aiClassificationJob.findFirst({
      where: { classificationVersionId: classificationId, status: { in: ACTIVE_STATUSES } },
      select: { id: true },
    });
    if (active) throw new ConflictException('Ya hay un análisis en curso para esta clasificación.');
    const created = await this.prisma.aiClassificationJob.create({
      data: { classificationVersionId: classificationId, actorId, sourceMarkdown, status: 'pending' },
      select: { id: true },
    });
    return { jobId: created.id };
  }

  async get(jobId: string): Promise<AiJobView> {
    const job = await this.prisma.aiClassificationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('No se encontró el análisis.');
    return { id: job.id, status: job.status as AiJobStatus, error: job.error ?? null };
  }

  async latestActive(classificationId: string): Promise<AiJobView | null> {
    const job = await this.prisma.aiClassificationJob.findFirst({
      where: { classificationVersionId: classificationId, status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'desc' },
    });
    return job ? { id: job.id, status: job.status as AiJobStatus, error: job.error ?? null } : null;
  }

  async recoverStuck(): Promise<number> {
    const result = await this.prisma.aiClassificationJob.updateMany({
      where: { status: 'processing' },
      data: { status: 'pending', updatedAt: new Date() },
    });
    return result.count;
  }

  async tick(): Promise<void> {
    const job = await this.claimNext();
    if (!job) return;
    try {
      const proposal = await this.ai.proposeFromMarkdown(job.classificationVersionId, job.sourceMarkdown ?? '');
      await this.catalog.saveDraft(job.actorId, job.classificationVersionId, this.toSaveDto(proposal));
      await this.prisma.aiClassificationJob.update({
        where: { id: job.id },
        data: { status: 'done', proposalJson: proposal as unknown as Prisma.InputJsonValue, updatedAt: new Date() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'El análisis con IA falló.';
      await this.prisma.aiClassificationJob.update({
        where: { id: job.id },
        data: { status: 'failed', error: message, updatedAt: new Date() },
      });
    }
  }

  private async claimNext() {
    const candidate = await this.prisma.aiClassificationJob.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;
    const claimed = await this.prisma.aiClassificationJob.updateMany({
      where: { id: candidate.id, status: 'pending' },
      data: { status: 'processing', updatedAt: new Date() },
    });
    if (claimed.count !== 1) return null;
    return this.prisma.aiClassificationJob.findUnique({ where: { id: candidate.id } });
  }

  private toSaveDto(proposal: AiProposal): SaveClassificationDto {
    return {
      contentTypeKey: proposal.contentTypeKey,
      contentTypeSchemaVersion: proposal.contentTypeSchemaVersion,
      featureSchemaVersion: proposal.featureSchemaVersion,
      tagTaxonomyVersion: proposal.tagTaxonomyVersion,
      features: Object.entries(proposal.features).map(([featureKey, feature]) => ({
        featureKey,
        value: feature.value,
        confidence: feature.confidence,
      })),
      tags: Object.entries(proposal.tags).map(([tagKey, tag]) => ({
        tagKey,
        strength: tag.strength,
        confidence: tag.confidence,
      })),
    };
  }
}
