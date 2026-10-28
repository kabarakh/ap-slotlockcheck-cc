import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useCurrentRoomStore } from '../current-room';
import { usePaceStore } from '../pace';
import { useUiStore } from '../ui';
import type { GamePace, RoomPace, SlotPace, SlotTimeline } from '@/api/types';
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

const slotTimeline: SlotTimeline = {
  slotId: 1,
  from: '2026-10-28T10:00:00.000Z',
  to: '2026-10-28T12:00:00.000Z',
  segments: [{ kind: 'active', from: '2026-10-28T10:00:00.000Z', to: '2026-10-28T12:00:00.000Z', checks: 10 }],
  progressionItemTimes: [],
  statusChanges: [],
  playerPeriods: [],
  unreadableSnapshots: [],
};

const TIMELINE_PATH = '/api/rooms/{slug}/pace/slots/{slotId}';

const respond = (timelineResult: () => Promise<unknown>, paceResult: RoomPace = roomPace) =>
  api.GET.mockImplementation((path: string) => (path === TIMELINE_PATH ? timelineResult() : ok(paceResult)));

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

  it('loads the timeline of a clicked row with time range', async () => {
    respond(() => ok(slotTimeline));
    const store = usePaceStore();
    await store.open();
    await store.openTimeline(slotPace({ slotId: 1, from: '2026-10-28T10:00:00.000Z' }));
    expect(api.GET).toHaveBeenCalledWith(TIMELINE_PATH, { params: { path: { slug: 'big-chill', slotId: 1 } } });
    expect(store.timeline).toEqual(slotTimeline);
    expect(store.timelineRow?.slotId).toBe(1);
  });

  it('does not open the timeline of a row without time range', async () => {
    const store = usePaceStore();
    await store.openTimeline(slotPace({ slotId: 2, hasRange: false }));
    expect(store.timelineRow).toBeNull();
    expect(api.GET).not.toHaveBeenCalled();
  });

  it('shows a missing slot and a missing checks history in the side panel', async () => {
    const store = usePaceStore();
    respond(() => failed(404, 'SLOT_NOT_FOUND'));
    await store.openTimeline(slotPace({ slotId: 1 }));
    expect(store.timelineError).toBe('SLOT_NOT_FOUND');
    respond(() => failed(503, 'CHECKS_HISTORY_NOT_AVAILABLE'));
    await store.fetchTimeline(1);
    expect(store.timelineError).toBe('CHECKS_HISTORY_NOT_AVAILABLE');
    expect(store.timeline).toBeNull();
    expect(useUiStore().messages).toEqual([]);
  });

  it('loads the open timeline again on a room update', async () => {
    respond(() => ok(slotTimeline));
    const store = usePaceStore();
    await store.open();
    await store.openTimeline(slotPace({ slotId: 1 }));
    await store.refresh();
    expect(api.GET.mock.calls.filter(([path]) => path === TIMELINE_PATH)).toHaveLength(2);
    expect(store.timelineRow?.slotId).toBe(1);
  });

  it('closes the timeline when the slot has no time range after a room update', async () => {
    respond(() => ok(slotTimeline));
    const store = usePaceStore();
    await store.open();
    await store.openTimeline(slotPace({ slotId: 1 }));
    respond(() => ok(slotTimeline), { ...roomPace, slots: [slotPace({ slotId: 1, hasRange: false })] });
    await store.refresh();
    expect(store.timelineRow).toBeNull();
    expect(store.timeline).toBeNull();
  });

  it('closes the timeline when the view closes', async () => {
    respond(() => ok(slotTimeline));
    const store = usePaceStore();
    await store.open();
    await store.openTimeline(slotPace({ slotId: 1 }));
    store.close();
    expect(store.timelineRow).toBeNull();
  });
});
