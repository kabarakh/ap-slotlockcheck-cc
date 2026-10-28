import { useIntervalFn, useNow } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { inactivityHours, inactivityLevel, type InactivityLevel } from '@/domain/inactivity';

const MINUTE_MS = 60_000;

export const useInactivityStore = defineStore('inactivity', () => {
  const currentTime = useNow({ scheduler: (callback) => useIntervalFn(callback, MINUTE_MS) });

  const now = computed(() => {
    const archivedAt = useCurrentRoomStore().room?.archivedAt;
    return archivedAt ? new Date(archivedAt) : currentTime.value;
  });

  const hoursBySlotId = computed(() => {
    const room = useCurrentRoomStore();
    return new Map(room.slots.map((slot) => [slot.id, inactivityHours(slot, now.value)]));
  });

  const levelBySlotId = computed(() => {
    const room = useCurrentRoomStore().room;
    const limits = { yellowLimitHours: room?.yellowLimitHours ?? 24, redLimitHours: room?.redLimitHours ?? 48 };
    return new Map<number, InactivityLevel>(
      [...hoursBySlotId.value.entries()].map(([slotId, hours]) => [slotId, inactivityLevel(hours, limits)]),
    );
  });

  return { now, hoursBySlotId, levelBySlotId };
});
