import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { ProfileService } from '../src/profile/profile.service';

describe('ProfileService.ensureProfile', () => {
  it('reads the profile created by a concurrent request after P2002', async () => {
    const profile = { id: 'profile-1' };
    const prisma = {
      user: { upsert: vi.fn().mockResolvedValue({ id: 'user-1' }) },
      readerProfile: {
        upsert: vi.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6.19.2', meta: { target: ['user_id'] } })),
        findUniqueOrThrow: vi.fn().mockResolvedValue(profile),
      },
    };
    const service = new ProfileService(prisma as never);
    vi.spyOn(service, 'ensurePublicSlug').mockResolvedValue('public-profile');

    await expect(service.ensureProfile('user-1')).resolves.toEqual(profile);
    expect(prisma.readerProfile.findUniqueOrThrow).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});
