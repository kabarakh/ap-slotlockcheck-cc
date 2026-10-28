import { defineStore } from 'pinia';
import { computed } from 'vue';

import { useCurrentRoomStore } from './current-room';
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

  return { playerSummaries, globalStatistics, unlockForest };
});
