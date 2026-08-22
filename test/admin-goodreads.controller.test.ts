import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AdminController } from '../src/admin/admin.controller';
import { EmailService } from '../src/email/email.service';
import { PrismaService } from '../src/prisma/prisma.service';

function createController() {
  const prisma = {
    readerProfile: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  } as unknown as PrismaService;
  const email = { sendRendered: vi.fn() } as unknown as EmailService;
  return { controller: new AdminController(prisma, email), prisma, email };
}

describe('AdminController Goodreads import completion', () => {
  it('sends the completion email and preserves the existing snapshot', async () => {
    const { controller, prisma, email } = createController();
    vi.mocked(prisma.readerProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      publicSlug: 'reader-1',
      optimisticLockVersion: 4,
      snapshotJson: { goodreads_library: [{ rating: 5 }, { rating: 2 }], supplemental_books: [{ title: 'Keep me' }] },
      user: { email: 'reader@example.com', displayName: 'Reader' },
    } as never);
    vi.mocked(email.sendRendered).mockResolvedValue(true);
    vi.mocked(prisma.readerProfile.updateMany).mockResolvedValue({ count: 1 } as never);

    const result = await controller.completeGoodreadsImport('user-1');

    expect(result.completed).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(email.sendRendered).toHaveBeenCalledWith(
      'reader@example.com',
      expect.objectContaining({ subject: expect.stringContaining('Goodreads'), html: expect.stringContaining('/perfil/reader-1') }),
      'libros/goodreads-imported/user-1',
    );
    expect(prisma.readerProfile.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'profile-1', optimisticLockVersion: 4 },
      data: expect.objectContaining({
        optimisticLockVersion: { increment: 1 },
        snapshotJson: expect.objectContaining({
          goodreads_library: [{ rating: 5 }, { rating: 2 }],
          supplemental_books: [{ title: 'Keep me' }],
          goodreads_import_completed_at: expect.any(String),
        }),
      }),
    }));
  });

  it('is idempotent after the import was already marked complete', async () => {
    const { controller, prisma, email } = createController();
    vi.mocked(prisma.readerProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      publicSlug: 'reader-1',
      optimisticLockVersion: 5,
      snapshotJson: { goodreads_import_completed_at: '2026-08-21T12:00:00.000Z' },
      user: { email: 'reader@example.com', displayName: 'Reader' },
    } as never);

    const result = await controller.completeGoodreadsImport('user-1');

    expect(result).toEqual({ completed: true, alreadyCompleted: true, completedAt: '2026-08-21T12:00:00.000Z', emailSent: true });
    expect(email.sendRendered).not.toHaveBeenCalled();
    expect(prisma.readerProfile.updateMany).not.toHaveBeenCalled();
  });

  it('does not mark the import when the email provider rejects the send', async () => {
    const { controller, prisma, email } = createController();
    vi.mocked(prisma.readerProfile.findUnique).mockResolvedValue({
      id: 'profile-1',
      publicSlug: 'reader-1',
      optimisticLockVersion: 4,
      snapshotJson: { goodreads_library: [] },
      user: { email: 'reader@example.com', displayName: 'Reader' },
    } as never);
    vi.mocked(email.sendRendered).mockResolvedValue(false);

    await expect(controller.completeGoodreadsImport('user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.readerProfile.updateMany).not.toHaveBeenCalled();
  });
});
