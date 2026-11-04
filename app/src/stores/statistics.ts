import { defineStore } from 'pinia';
import { computed } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useStatisticsFilterStore } from './statistics-filter';
import { useWarningsStore } from './warnings';
import { calculateStatistics, summarizePlayers } from '@/domain/summary';
import { buildUnlockForest } from '@/domain/unlock-tree';

export const useStatisticsStore = defineStore('statistics', () => {
  const playerSummaries = computed(() => {
    const room = useCurrentRoomStore();
    return summarizePlayers(room.slots, room.isAdmin ? useWarningsStore().countBySlotId : new Map());
  });
  const globalStatistics = computed(() => calculateStatistics(useCurrentRoomStore().slots));
  const unlockForest = computed(() => buildUnlockForest(useCurrentRoomStore().slots));
  const filteredSlots = computed(() => useStatisticsFilterStore().filteredSlots);
  const filteredSummaries = computed(() => summarizePlayers(filteredSlots.value));
  const filteredStatistics = computed(() => calculateStatistics(filteredSlots.value));

  return { playerSummaries, globalStatistics, unlockForest, filteredSlots, filteredSummaries, filteredStatistics };
});
