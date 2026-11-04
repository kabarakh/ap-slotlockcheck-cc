import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useCurrentRoomStore } from '../current-room';
import { useRoomHistoryStore } from '../room-history';
import { useStatisticsFilterStore } from '../statistics-filter';
import { roomDetail, slotRow } from '@/domain/__tests__/fixtures';

type Call = (path: string, options?: unknown) => Promise<unknown>;

const api = vi.hoisted(() => ({ GET: vi.fn<Call>() }));

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api,
}));

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });

describe('statistics filter', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.GET.mockReset();
    const room = useCurrentRoomStore();
    room.slug = 'big-chill';
    room.room = roomDetail();
    room.slots = [
      slotRow({ id: 1, name: 'Locker', isSlotLock: true }),
      slotRow({ id: 2, name: 'A', discordUserId: 'a', discordName: 'alice' }),
      slotRow({ id: 3, name: 'B', discordUserId: 'b', discordName: 'bob' }),
      slotRow({ id: 4, name: 'C', discordUserId: 'a', discordName: 'alice' }),
    ];
  });

  it('includes all slots without a filter', () => {
    const filter = useStatisticsFilterStore();
    expect(filter.isActive).toBe(false);
    expect(filter.filteredSlots).toHaveLength(4);
    expect(filter.historySlotIds).toBeUndefined();
  });

  it('includes the slots of the selected players and the selected slots', () => {
    const filter = useStatisticsFilterStore();
    filter.playerKeys = ['a'];
    filter.slotIds = [3];
    expect(filter.filteredSlots.map((slot) => slot.name)).toEqual(['A', 'B', 'C']);
    expect(filter.historySlotIds).toEqual([2, 3, 4]);
    expect(filter.includes(1)).toBe(false);
    filter.clear();
    expect(filter.includes(1)).toBe(true);
  });

  it('gives the player options with the slot count', () => {
    expect(useStatisticsFilterStore().playerOptions).toEqual([
      { value: 'a', label: 'alice (2)' },
      { value: 'b', label: 'bob (1)' },
    ]);
  });

  it('loads the history again with the selected slots', async () => {
    api.GET.mockImplementation(() => ok({ slots: [] }));
    const history = useRoomHistoryStore();
    await history.open();
    const filter = useStatisticsFilterStore();
    filter.slotIds = [3];
    await vi.waitFor(() => expect(api.GET).toHaveBeenCalledTimes(2));
    expect(api.GET).toHaveBeenLastCalledWith('/api/rooms/{slug}/statistics/history', {
      params: { path: { slug: 'big-chill' }, query: { slotIds: [3] } },
    });
  });
});
