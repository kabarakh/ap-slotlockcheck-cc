import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { RoomDetail } from '@/api/types';
import { slotRow } from '@/domain/__tests__/fixtures';
import { useCurrentRoomStore } from '../current-room';

const room: RoomDetail = {
  id: 1,
  slug: 'big-chill',
  title: 'Big Chill',
  slotCount: 2,
  lockedSlotCount: 1,
  unlockedSlotCount: 0,
  unlockedPercentage: 0,
  syncStatus: { lastSyncAt: null, lastSuccessfulSyncAt: null, lastSyncError: null, running: false },
  cheeseTrackerId: 'AbCdEfGhIjKlMnOpQrStUv',
  cheeseTrackerUrl: 'https://cheese.test/tracker/AbCdEfGhIjKlMnOpQrStUv',
  archipelagoTrackerUrl: 'https://archipelago.gg/tracker/x',
  yellowLimitHours: 24,
  redLimitHours: 48,
  limitsOverridden: false,
  unknownSlotNames: [],
  manualSyncCooldownSeconds: 60,
  hasSeed: false,
  sphereOffset: 0,
  visitorsSeeLocations: false,
  playersMarkFiller: false,
};

describe('useCurrentRoomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('applies changed, new and removed slots of a synchronization', () => {
    const store = useCurrentRoomStore();
    store.slug = 'big-chill';
    store.room = room;
    store.slots = [slotRow({ id: 1, name: 'A' }), slotRow({ id: 2, name: 'B' })];
    store.applySynced({
      slug: 'big-chill',
      room: { ...room, unlockedSlotCount: 1 },
      changedSlots: [slotRow({ id: 1, name: 'A', lockStatus: 'unlocked' }), slotRow({ id: 3, name: 'C' })],
      removedSlotIds: [2],
    });
    expect(store.slots.map((slot) => [slot.id, slot.lockStatus])).toEqual([
      [1, 'unlocked'],
      [3, 'not_locked'],
    ]);
    expect(store.room?.unlockedSlotCount).toBe(1);
  });

  it('replaces the room details after a synchronization', () => {
    const store = useCurrentRoomStore();
    store.slug = 'big-chill';
    store.room = { ...room, unknownSlotNames: ['Jiggy', 'Juliana'] };
    store.applySynced({ slug: 'big-chill', room, changedSlots: [], removedSlotIds: [] });
    expect(store.room?.unknownSlotNames).toEqual([]);
  });

  it('ignores messages of other rooms', () => {
    const store = useCurrentRoomStore();
    store.slug = 'big-chill';
    store.room = room;
    store.applySyncFailed({
      slug: 'other',
      syncStatus: { lastSyncAt: null, lastSuccessfulSyncAt: null, lastSyncError: 'x', running: false },
    });
    expect(store.room?.syncStatus.lastSyncError).toBeNull();
  });
});
