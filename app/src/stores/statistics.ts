import { computed } from 'vue';
import { defineStore } from 'pinia';
import { calculateStatistics, summarizePlayers } from '@/domain/summary';
import { useCurrentRoomStore } from './current-room';

export const useStatisticsStore = defineStore('statistics', () => {
  const playerSummaries = computed(() => summarizePlayers(useCurrentRoomStore().slots));
  const globalStatistics = computed(() => calculateStatistics(useCurrentRoomStore().slots));

  return { playerSummaries, globalStatistics };
});
