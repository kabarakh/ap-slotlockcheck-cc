import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { useCurrentRoomStore } from '../current-room';
import type { RoomDetail } from '@/api/types';
import { roomDetail, slotRow } from '@/domain/__tests__/fixtures';

const room: RoomDetail = roomDetail();

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

  it('lists slots without a Discord user, but not goaled slots and slots with all checks', () => {
    const store = useCurrentRoomStore();
    store.slots = [
      slotRow({ id: 1, name: 'Open' }),
      slotRow({ id: 2, name: 'Goaled', completionStatus: 'goal' }),
      slotRow({ id: 3, name: 'Done', checksDone: 10 }),
      slotRow({ id: 4, name: 'Claimed', discordUserId: '1' }),
    ];
    expect(store.slotsWithoutDiscord.map((slot) => slot.name)).toEqual(['Open']);
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
