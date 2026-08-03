import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AiClassificationJobsService } from '../src/ai/ai-classification-jobs.service';

const jobRow = {
  id: 'job-1',
  classificationVersionId: 'class-1',
  actorId: 'actor-1',
  status: 'pending',
  sourceMarkdown: 'md',
  proposalJson: null,
  error: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const proposal = {
  contentTypeKey: 'fiction',
  contentTypeSchemaVersion: 'content-types/1.0',
  featureSchemaVersion: 'book-features/1.0',
  tagTaxonomyVersion: 'tag-tax/1.0.1',
  features: {
    hook_speed: { value: 0.85, confidence: 0.4 },
    narrative_pace: { value: 0.4, confidence: 0.2 },
  },
  tags: {
    science_fiction: { strength: 0.9, confidence: 0.4 },
    love: { strength: 0.6, confidence: 0.3 },
  },
};

function makeJobs({ ai = {}, catalog = {}, prismaOverrides = {} } = {}) {
  const prisma = {
    aiClassificationJob: {
      create: vi.fn().mockResolvedValue({ id: 'job-1' }),
      findFirst: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(jobRow),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue(jobRow),
    },
    ...prismaOverrides,
  };
  const aiService = { proposeFromMarkdown: vi.fn().mockResolvedValue(proposal), ...ai };
  const catalogService = { saveDraft: vi.fn().mockResolvedValue({}), ...catalog };
  const service = new AiClassificationJobsService(prisma as never, aiService as never, catalogService as never);
  return { service, prisma, aiService, catalogService };
}

describe('AiClassificationJobsService', () => {
  it('creates a job and rejects when another is active for the same classification', async () => {
    const { service, prisma } = makeJobs();
    const created = await service.create('actor-1', 'class-1', 'markdown');
    expect(created).toEqual({ jobId: 'job-1' });
    expect(prisma.aiClassificationJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ classificationVersionId: 'class-1', actorId: 'actor-1', sourceMarkdown: 'markdown' }),
      select: { id: true },
    });

    prisma.aiClassificationJob.findFirst.mockResolvedValueOnce({ id: 'job-2' });
    await expect(service.create('actor-1', 'class-1', 'markdown')).rejects.toThrow(ConflictException);
  });

  it('persists the proposal as a draft and marks the job done', async () => {
    const { service, prisma, aiService, catalogService } = makeJobs();
    prisma.aiClassificationJob.findFirst.mockResolvedValueOnce(jobRow);
    prisma.aiClassificationJob.findUnique.mockResolvedValueOnce({ ...jobRow, status: 'processing' });

    await service.tick();

    expect(aiService.proposeFromMarkdown).toHaveBeenCalledWith('class-1', 'md');
    expect(catalogService.saveDraft).toHaveBeenCalledWith(
      'actor-1',
      'class-1',
      expect.objectContaining({
        contentTypeKey: 'fiction',
        features: [
          { featureKey: 'hook_speed', value: 0.85, confidence: 0.4 },
          { featureKey: 'narrative_pace', value: 0.4, confidence: 0.2 },
        ],
        tags: [
          { tagKey: 'science_fiction', strength: 0.9, confidence: 0.4 },
          { tagKey: 'love', strength: 0.6, confidence: 0.3 },
        ],
      }),
    );
    const updateCall = prisma.aiClassificationJob.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data.status).toBe('done');
  });

  it('marks the job failed when analysis fails, without persisting', async () => {
    const { service, prisma, aiService, catalogService } = makeJobs({ ai: { proposeFromMarkdown: vi.fn().mockRejectedValue(new Error('boom')) } });
    prisma.aiClassificationJob.findFirst.mockResolvedValueOnce(jobRow);
    prisma.aiClassificationJob.findUnique.mockResolvedValueOnce({ ...jobRow, status: 'processing' });

    await service.tick();

    expect(catalogService.saveDraft).not.toHaveBeenCalled();
    const updateCall = prisma.aiClassificationJob.update.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(updateCall.data.status).toBe('failed');
    expect(updateCall.data.error).toBe('boom');
  });

  it('recovers jobs stuck in processing', async () => {
    const { service, prisma } = makeJobs();
    prisma.aiClassificationJob.updateMany.mockResolvedValueOnce({ count: 3 });
    await expect(service.recoverStuck()).resolves.toBe(3);
    expect(prisma.aiClassificationJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'processing' }, data: expect.objectContaining({ status: 'pending' }) }),
    );
  });
});
