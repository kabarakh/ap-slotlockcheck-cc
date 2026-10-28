import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useCurrentRoomStore } from '../current-room';
import { usePaceStore } from '../pace';
import { useUiStore } from '../ui';
import type { GamePace, RoomPace, SlotPace } from '@/api/types';
import { roomDetail } from '@/domain/__tests__/fixtures';

type Call = (path: string, options?: unknown) => Promise<unknown>;

const api = vi.hoisted(() => ({ GET: vi.fn<Call>() }));

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api,
}));

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });
const failed = (status: number, code: string) =>
  Promise.resolve({ error: { statusCode: status, code, message: code }, response: new Response(null, { status }) });

const slotPace = (overrides: Partial<SlotPace>): SlotPace => ({
  slotId: 1,
  name: 'Slot',
  game: 'Game',
  hasRange: true,
  discordUserId: null,
  discordName: null,
  from: null,
  to: null,
  activeMinutes: 60,
  checks: 10,
  checksPerHour: 10,
  minutesPerCheck: 6,
  bkMinutes: 0,
  bkShare: 0,
  bkCount: 0,
  longestBkMinutes: null,
  breakMinutes: 0,
  startKind: 'unlock',
  partialSignals: false,
  ...overrides,
});

const gamePace = (overrides: Partial<GamePace>): GamePace => ({
  game: 'Game',
  slotCount: 1,
  activeMinutes: 60,
  checks: 10,
  checksPerHour: 10,
  medianChecksPerHour: 10,
  ...overrides,
});

const roomPace: RoomPace = {
  calculatedAt: '2026-10-28T12:00:00.000Z',
  signalsFrom: '2026-10-27T12:00:00.000Z',
  limits: { breakLimitMinutes: 30, bulkLimitChecks: 40 },
  slots: [slotPace({ slotId: 1 }), slotPace({ slotId: 2, hasRange: false })],
  games: [gamePace({ game: 'Game' }), gamePace({ game: 'Other', slotCount: 0 })],
};

describe('usePaceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.GET.mockReset();
    const room = useCurrentRoomStore();
    room.slug = 'big-chill';
    room.room = roomDetail();
  });

  it('hides slots without time range and games without rows until the switch shows them', async () => {
    api.GET.mockReturnValue(ok(roomPace));
    const store = usePaceStore();
    await store.open();
    expect(api.GET).toHaveBeenCalledWith('/api/rooms/{slug}/pace', { params: { path: { slug: 'big-chill' } } });
    expect(store.visibleSlots.map((slot) => slot.slotId)).toEqual([1]);
    expect(store.visibleGames.map((game) => game.game)).toEqual(['Game']);
    store.showWithoutRange = true;
    expect(store.visibleSlots.map((slot) => slot.slotId)).toEqual([1, 2]);
    expect(store.visibleGames.map((game) => game.game)).toEqual(['Game', 'Other']);
  });

  it('loads again on a room update only while the view is open', async () => {
    api.GET.mockReturnValue(ok(roomPace));
    const store = usePaceStore();
    const room = useCurrentRoomStore();
    const update = { slug: 'big-chill', room: roomDetail(), slots: [] };
    room.applyUpdated(update);
    await Promise.resolve();
    expect(api.GET).not.toHaveBeenCalled();
    await store.open();
    room.applyUpdated(update);
    await vi.waitFor(() =>
      expect(api.GET.mock.calls.filter(([path]) => path === '/api/rooms/{slug}/pace')).toHaveLength(2),
    );
    store.close();
    room.applyUpdated(update);
    await Promise.resolve();
    expect(api.GET.mock.calls.filter(([path]) => path === '/api/rooms/{slug}/pace')).toHaveLength(2);
  });

  it('loads again after a synchronization only while the view is open', async () => {
    api.GET.mockReturnValue(ok(roomPace));
    const store = usePaceStore();
    const room = useCurrentRoomStore();
    const synced = { slug: 'big-chill', room: roomDetail(), changedSlots: [], removedSlotIds: [] };
    room.applySynced(synced);
    await Promise.resolve();
    expect(api.GET).not.toHaveBeenCalled();
    await store.open();
    room.applySynced(synced);
    await vi.waitFor(() => expect(api.GET).toHaveBeenCalledTimes(2));
    store.close();
    room.applySynced(synced);
    await Promise.resolve();
    expect(api.GET).toHaveBeenCalledTimes(2);
  });

  it('shows a missing checks history in the view and not as a message', async () => {
    api.GET.mockReturnValue(failed(503, 'CHECKS_HISTORY_NOT_AVAILABLE'));
    const store = usePaceStore();
    await store.open();
    expect(store.historyUnavailable).toBe(true);
    expect(store.pace).toBeNull();
    expect(useUiStore().messages).toEqual([]);
  });

  it('gives other errors to the messages', async () => {
    api.GET.mockReturnValue(failed(500, 'INTERNAL_ERROR'));
    const store = usePaceStore();
    await store.open();
    expect(store.historyUnavailable).toBe(false);
    expect(useUiStore().messages.map((message) => message.key)).toEqual(['errors.INTERNAL_ERROR']);
  });
});
