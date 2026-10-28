import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useCurrentRoomStore } from '../current-room';
import { useInactivityReminderStore } from '../inactivity-reminder';
import { roomDetail, slotRow } from '@/domain/__tests__/fixtures';

const writeText = vi.fn<(text: string) => Promise<void>>();

describe('useInactivityReminderStore', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-24T12:00:00Z') });
    setActivePinia(createPinia());
    writeText.mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const room = useCurrentRoomStore();
    room.room = roomDetail({ yellowLimitHours: 24, redLimitHours: 48 });
    room.slots = [
      slotRow({ id: 1, position: 1, name: 'Yellow', lockStatus: 'unlocked', lastActivity: '2026-10-23T00:00:00Z' }),
      slotRow({ id: 2, position: 2, name: 'Red', lockStatus: 'unlocked', lastActivity: '2026-10-20T00:00:00Z' }),
      slotRow({
        id: 3,
        position: 3,
        name: 'Done',
        lockStatus: 'unlocked',
        lastActivity: '2026-10-20T00:00:00Z',
        checksDone: 10,
      }),
      slotRow({ id: 4, position: 4, name: 'Fresh', lockStatus: 'unlocked', lastActivity: '2026-10-24T11:00:00Z' }),
    ];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts the yellow and red slots without the slots with all checks', () => {
    expect(useInactivityReminderStore().levelCounts).toEqual({ yellow: 1, red: 1 });
  });

  it('copies the reminder of one slot', async () => {
    const reminder = useInactivityReminderStore();
    expect(reminder.canRemind(2)).toBe(true);
    expect(reminder.canRemind(3)).toBe(false);
    expect(reminder.canRemind(4)).toBe(false);
    await reminder.copyForSlot(2);
    expect(writeText).toHaveBeenCalledWith('# Inactive slots\n🔴 Red (Game): inactive for 4 d 12 h, 0/10 checks');
  });
});
