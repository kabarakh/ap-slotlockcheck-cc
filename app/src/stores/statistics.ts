import { computed } from 'vue';
import { defineStore } from 'pinia';
import { calculateStatistics, summarizePlayers } from '@/domain/summary';
import { buildUnlockForest } from '@/domain/unlock-tree';
import { useCurrentRoomStore } from './current-room';

export const useStatisticsStore = defineStore('statistics', () => {
  const playerSummaries = computed(() => summarizePlayers(useCurrentRoomStore().slots));
  const globalStatistics = computed(() => calculateStatistics(useCurrentRoomStore().slots));
  const unlockForest = computed(() => buildUnlockForest(useCurrentRoomStore().slots));

  return { playerSummaries, globalStatistics, unlockForest };
});
