import { computed } from 'vue';
import { defineStore } from 'pinia';

import { calculateStatistics, summarizePlayers } from '@/domain/summary';
import { buildUnlockForest } from '@/domain/unlock-tree';
import { useCurrentRoomStore } from './current-room';
import { useWarningsStore } from './warnings';

export const useStatisticsStore = defineStore('statistics', () => {
  const playerSummaries = computed(() => {
    const room = useCurrentRoomStore();
    return summarizePlayers(room.slots, room.isAdmin ? useWarningsStore().countBySlotId : new Map());
  });
  const globalStatistics = computed(() => calculateStatistics(useCurrentRoomStore().slots));
  const unlockForest = computed(() => buildUnlockForest(useCurrentRoomStore().slots));

  return { playerSummaries, globalStatistics, unlockForest };
});
