import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useCurrentRoomStore } from '../current-room';
import { useRoomArchiveStore } from '../room-archive';
import { roomDetail } from '@/domain/__tests__/fixtures';

type Call = (path: string, options?: unknown) => Promise<unknown>;

const api = vi.hoisted(() => ({ POST: vi.fn<Call>(), DELETE: vi.fn<Call>() }));

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api,
}));

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });

describe('useRoomArchiveStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.POST.mockReset();
    api.DELETE.mockReset();
    useCurrentRoomStore().slug = 'big-chill';
    useCurrentRoomStore().room = roomDetail();
  });

  it('archives the room and takes the answer as the current room', async () => {
    const archived = roomDetail({ archivedAt: '2026-10-28T12:00:00.000Z', archiveReason: 'manual' });
    api.POST.mockReturnValue(ok(archived));
    const store = useRoomArchiveStore();
    store.ask();
    await expect(store.archive()).resolves.toBe(true);
    expect(api.POST).toHaveBeenCalledWith('/api/rooms/{slug}/archive', { params: { path: { slug: 'big-chill' } } });
    expect(useCurrentRoomStore().isArchived).toBe(true);
    expect(store.confirming).toBe(false);
  });

  it('reopens the room', async () => {
    useCurrentRoomStore().room = roomDetail({ archivedAt: '2026-10-28T12:00:00.000Z', archiveReason: 'auto' });
    api.DELETE.mockReturnValue(ok(roomDetail({ autoArchive: false })));
    await expect(useRoomArchiveStore().reopen()).resolves.toBe(true);
    expect(api.DELETE).toHaveBeenCalledWith('/api/rooms/{slug}/archive', { params: { path: { slug: 'big-chill' } } });
    expect(useCurrentRoomStore().isArchived).toBe(false);
  });
});
