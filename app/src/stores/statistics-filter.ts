import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { useAuthStore } from './auth';
import { useCurrentRoomStore } from './current-room';
import { useRoomHistoryStore } from './room-history';
import type { SlotRow } from '@/api/types';
import { playerKey } from '@/domain/summary';

export interface FilterOption<Value> {
  value: Value;
  label: string;
}

export const useStatisticsFilterStore = defineStore('statistics-filter', () => {
  const playerKeys = ref<string[]>([]);
  const slotIds = ref<number[]>([]);

  const playableSlots = computed(() => useCurrentRoomStore().playableSlots);
  const isActive = computed(() => playerKeys.value.length > 0 || slotIds.value.length > 0);

  const includedSlotIds = computed<ReadonlySet<number> | null>(() => {
    if (!isActive.value) {
      return null;
    }
    const players = new Set(playerKeys.value);
    const chosen = new Set(slotIds.value);
    return new Set(
      playableSlots.value.filter((slot) => players.has(playerKey(slot)) || chosen.has(slot.id)).map((slot) => slot.id),
    );
  });

  const includes = (slotId: number): boolean => includedSlotIds.value?.has(slotId) ?? true;

  const filteredSlots = computed<SlotRow[]>(() => {
    const room = useCurrentRoomStore();
    const included = includedSlotIds.value;
    return included === null ? room.slots : room.slots.filter((slot) => included.has(slot.id));
  });

  const historySlotIds = computed(() =>
    includedSlotIds.value === null ? undefined : [...includedSlotIds.value].sort((a, b) => a - b),
  );

  const playerOptions = computed<FilterOption<string>[]>(() => {
    const names = new Map<string, { name: string; count: number }>();
    for (const slot of playableSlots.value) {
      const key = playerKey(slot);
      const current = names.get(key) ?? { name: slot.discordName ?? '', count: 0 };
      current.count += 1;
      names.set(key, current);
    }
    return [...names.entries()]
      .map(([value, entry]) => ({ value, label: `${entry.name || '–'} (${entry.count})` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  const slotOptions = computed<FilterOption<number>[]>(() =>
    playableSlots.value
      .map((slot) => ({ value: slot.id, label: slot.discordName ? `${slot.name} (${slot.discordName})` : slot.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  );

  const ownPlayerKey = computed(() => {
    const discordId = useAuthStore().user?.discordId;
    return discordId && playableSlots.value.some((slot) => slot.discordUserId === discordId) ? discordId : null;
  });

  const showOwn = () => {
    if (ownPlayerKey.value !== null) {
      playerKeys.value = [ownPlayerKey.value];
      slotIds.value = [];
    }
  };

  const clear = () => {
    playerKeys.value = [];
    slotIds.value = [];
  };

  watch(historySlotIds, (current, previous) => {
    if (JSON.stringify(current) !== JSON.stringify(previous)) {
      void useRoomHistoryStore().refresh();
    }
  });

  return {
    playerKeys,
    slotIds,
    isActive,
    includedSlotIds,
    includes,
    filteredSlots,
    historySlotIds,
    playerOptions,
    slotOptions,
    ownPlayerKey,
    showOwn,
    clear,
  };
});
