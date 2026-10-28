import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useCurrentRoomStore } from '../current-room';
import { useSeedStore } from '../seed';
import { roomDetail } from '@/domain/__tests__/fixtures';

type Call = (path: string, options?: unknown) => Promise<unknown>;

const api = vi.hoisted(() => ({ GET: vi.fn<Call>() }));

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api,
}));

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });

describe('useSeedStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.GET.mockReset();
    useCurrentRoomStore().slug = 'big-chill';
    useCurrentRoomStore().room = roomDetail();
  });

  it('loads the comparison of the uploaded seed with the seed of the server', async () => {
    const comparison = { uploadedSeedName: '1', serverSeedName: '2', serverError: null, matches: false };
    api.GET.mockReturnValue(ok(comparison));
    const store = useSeedStore();
    await store.compare();
    expect(api.GET).toHaveBeenCalledWith('/api/rooms/{slug}/seed/comparison', {
      params: { path: { slug: 'big-chill' } },
    });
    expect(store.comparison).toEqual(comparison);
    expect(store.comparing).toBe(false);
    store.clear();
    expect(store.comparison).toBeNull();
  });
});
