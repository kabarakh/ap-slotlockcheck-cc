import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { LockStatus, SlotRow } from '@/api/types';
import type { InactivityLevel } from '@/domain/inactivity';
import { useCurrentRoomStore } from './current-room';
import { useInactivityStore } from './inactivity';
import { useStatisticsStore } from './statistics';

export interface SlotFilter {
  text: string;
  lockStatuses: LockStatus[];
  inactivityLevels: InactivityLevel[];
  hideSlotLockSlots: boolean;
}

const emptySlotFilter = (): SlotFilter => ({
  text: '',
  lockStatuses: [],
  inactivityLevels: [],
  hideSlotLockSlots: true,
});

function matchesText(slot: SlotRow, text: string): boolean {
  const needle = text.trim().toLocaleLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return [slot.name, slot.game, slot.discordName ?? '', slot.notes, ...slot.locks.map((lock) => lock.senderName ?? '')]
    .join(' ')
    .toLocaleLowerCase()
    .includes(needle);
}

export const useTableFiltersStore = defineStore(
  'tableFilters',
  () => {
    const roster = ref<SlotFilter>(emptySlotFilter());
    const mySlots = ref<SlotFilter>({ ...emptySlotFilter(), hideSlotLockSlots: false });
    const playerText = ref('');
    const roomText = ref('');

    const applySlotFilter = (slots: SlotRow[], filter: SlotFilter): SlotRow[] => {
      const levels = useInactivityStore().levelBySlotId;
      return slots.filter(
        (slot) =>
          (!filter.hideSlotLockSlots || !slot.isSlotLock) &&
          (filter.lockStatuses.length === 0 || filter.lockStatuses.includes(slot.lockStatus)) &&
          (filter.inactivityLevels.length === 0 || filter.inactivityLevels.includes(levels.get(slot.id) ?? 'none')) &&
          matchesText(slot, filter.text),
      );
    };

    const filteredRoster = computed(() => applySlotFilter(useCurrentRoomStore().sortedSlots, roster.value));
    const filteredMySlots = computed(() => applySlotFilter(useCurrentRoomStore().mySlots, mySlots.value));
    const filteredPlayers = computed(() => {
      const needle = playerText.value.trim().toLocaleLowerCase();
      return useStatisticsStore().playerSummaries.filter((player) => player.name.toLocaleLowerCase().includes(needle));
    });

    const resetRosterFilter = () => {
      roster.value = emptySlotFilter();
    };

    const resetMySlotsFilter = () => {
      mySlots.value = { ...emptySlotFilter(), hideSlotLockSlots: false };
    };

    return {
      roster,
      mySlots,
      playerText,
      roomText,
      filteredRoster,
      filteredMySlots,
      filteredPlayers,
      resetRosterFilter,
      resetMySlotsFilter,
    };
  },
  { persist: { pick: ['roster', 'mySlots'] } },
);
