import { describe, expect, it, vi } from 'vitest';
import { deriveTagPreferences } from '../src/feedback/feedback-tag-preferences';

describe('deriveTagPreferences', () => {
  it('replaces preferences with one bulk delete and one bulk insert', async () => {
    const tx = {
      readerTagEvidence: {
        findMany: vi.fn().mockResolvedValue([
          { tagKey: 'fantasy', adjustment: 0.8, finalWeight: 1, status: 'active' },
          { tagKey: 'fantasy', adjustment: 0.4, finalWeight: 1, status: 'active' },
          { tagKey: 'history', adjustment: -0.4, finalWeight: 1, status: 'active' },
        ]),
      },
      tagVersion: {
        findMany: vi.fn().mockResolvedValue([
          { tagKey: 'fantasy', tagType: 'genre' },
          { tagKey: 'history', tagType: 'theme' },
        ]),
      },
      readerTagPreference: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };

    await deriveTagPreferences(tx as never, 'profile-1');

    expect(tx.readerTagPreference.deleteMany).toHaveBeenCalledWith({ where: { profileId: 'profile-1' } });
    const { data } = tx.readerTagPreference.createMany.mock.calls[0]![0] as { data: Array<{ affinity: { toString(): string }; confidence: { toString(): string }; [key: string]: unknown }> };
    expect(data.map((item) => ({ ...item, affinity: item.affinity.toString(), confidence: item.confidence.toString() }))).toEqual([
      { profileId: 'profile-1', tagKey: 'fantasy', tagType: 'genre', affinity: '0.6', confidence: '0.4866', evidenceCount: 2 },
      { profileId: 'profile-1', tagKey: 'history', tagType: 'theme', affinity: '-0.4', confidence: '0.2835', evidenceCount: 1 },
    ]);
  });
});
