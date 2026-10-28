import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { useCurrentRoomStore } from '../current-room';
import { useInactivityStore } from '../inactivity';
import { roomDetail, slotRow } from '@/domain/__tests__/fixtures';

describe('useInactivityStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('counts the inactivity of an archived room up to the archive time', () => {
    const room = useCurrentRoomStore();
    room.room = roomDetail({ archivedAt: '2026-10-02T00:00:00.000Z', archiveReason: 'manual' });
    room.slots = [slotRow({ id: 1, lockStatus: 'start_slot', lastActivity: '2026-10-01T00:00:00.000Z' })];
    expect(useInactivityStore().now.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(useInactivityStore().hoursBySlotId.get(1)).toBe(24);
  });
});
