import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useCurrentRoomStore } from '../current-room';
import { useSphereCleanupStore } from '../sphere-cleanup';

const apiGet = vi.hoisted(() => vi.fn<(path: string, options?: unknown) => Promise<unknown>>());

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api: { GET: apiGet },
}));

describe('useSphereCleanupStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useCurrentRoomStore().slug = 'big-chill';
    apiGet.mockResolvedValue({
      data: {
        fromSphere: 4,
        toSphere: 4,
        entries: [
          {
            slotId: 1,
            slotName: 'HerbMC',
            discordUserId: '123',
            discordName: 'Kabarakh',
            progression: 3,
            useful: 2,
            normal: 3,
            trap: 0,
          },
        ],
      },
      response: new Response(null, { status: 200 }),
    });
  });

  it('makes the messages from the entries and the ping option', async () => {
    const cleanup = useSphereCleanupStore();
    expect(cleanup.messages).toEqual([]);
    cleanup.draft = { fromSphere: 4, toSphere: 4, slots: 'progression', excludeGoaled: true, pings: true };
    await cleanup.fetch();
    expect(apiGet).toHaveBeenCalledWith('/api/rooms/{slug}/sphere-cleanup', {
      params: {
        path: { slug: 'big-chill' },
        query: { fromSphere: 4, toSphere: 4, slots: 'progression', excludeGoaled: true },
      },
    });
    expect(cleanup.messages).toEqual([
      '# Sphere 4\n<@123>, HerbMC: 3 progression, 5 filler (2 useful, 3 normal, 0 traps)',
    ]);
    cleanup.draft.pings = false;
    expect(cleanup.messages[0]).toContain('Kabarakh, HerbMC');
  });

  it('uses a preset sphere one time and loads the text at once', async () => {
    const cleanup = useSphereCleanupStore();
    cleanup.presetSphere(4);
    expect(await cleanup.prepare()).toBe(true);
    expect(cleanup.draft.fromSphere).toBe(4);
    expect(cleanup.draft.toSphere).toBe(4);
    expect(cleanup.messages).toHaveLength(1);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
