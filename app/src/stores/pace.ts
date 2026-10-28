import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';
import { api, ApiRequestError, unwrap } from '@/api/client';
import type { RoomPace, SlotPace, SlotTimeline } from '@/api/types';

export const CHECKS_HISTORY_NOT_AVAILABLE = 'CHECKS_HISTORY_NOT_AVAILABLE';
export const SLOT_NOT_FOUND = 'SLOT_NOT_FOUND';

const TIMELINE_ERRORS = [SLOT_NOT_FOUND, CHECKS_HISTORY_NOT_AVAILABLE];

export const usePaceStore = defineStore(
  'pace',
  () => {
    const pace = ref<RoomPace | null>(null);
    const showWithoutRange = ref(false);
    const loading = ref(false);
    const historyUnavailable = ref(false);
    const isOpen = ref(false);
    const timelineRow = ref<SlotPace | null>(null);
    const timeline = ref<SlotTimeline | null>(null);
    const timelineLoading = ref(false);
    const timelineError = ref<string | null>(null);

    const visibleSlots = computed(() =>
      (pace.value?.slots ?? []).filter((slot) => showWithoutRange.value || slot.hasRange),
    );
    const visibleGames = computed(() =>
      (pace.value?.games ?? []).filter((game) => showWithoutRange.value || game.slotCount > 0),
    );

    const fetch = async (): Promise<void> => {
      const slug = useCurrentRoomStore().slug;
      if (!slug) {
        pace.value = null;
        return;
      }
      loading.value = true;
      try {
        pace.value = await unwrap(api.GET('/api/rooms/{slug}/pace', { params: { path: { slug } } }));
        historyUnavailable.value = false;
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === CHECKS_HISTORY_NOT_AVAILABLE) {
          pace.value = null;
          historyUnavailable.value = true;
        } else {
          useUiStore().notifyError(error);
        }
      } finally {
        loading.value = false;
      }
    };

    const fetchTimeline = async (slotId: number): Promise<void> => {
      const slug = useCurrentRoomStore().slug;
      if (!slug) {
        return;
      }
      timelineLoading.value = true;
      try {
        const result = await unwrap(
          api.GET('/api/rooms/{slug}/pace/slots/{slotId}', { params: { path: { slug, slotId } } }),
        );
        if (timelineRow.value?.slotId === slotId) {
          timeline.value = result;
          timelineError.value = null;
        }
      } catch (error) {
        if (timelineRow.value?.slotId !== slotId) {
          return;
        }
        if (error instanceof ApiRequestError && TIMELINE_ERRORS.includes(error.code)) {
          timeline.value = null;
          timelineError.value = error.code;
        } else {
          useUiStore().notifyError(error);
        }
      } finally {
        timelineLoading.value = false;
      }
    };

    const openTimeline = async (row: SlotPace): Promise<void> => {
      if (!row.hasRange) {
        return;
      }
      timelineRow.value = row;
      timeline.value = null;
      timelineError.value = null;
      await fetchTimeline(row.slotId);
    };

    const closeTimeline = () => {
      timelineRow.value = null;
      timeline.value = null;
      timelineError.value = null;
    };

    const reloadTimeline = async (): Promise<void> => {
      const selected = timelineRow.value;
      if (selected === null) {
        return;
      }
      if (pace.value) {
        const rows = pace.value.slots.filter((row) => row.slotId === selected.slotId && row.hasRange);
        const row = rows.find((candidate) => candidate.from === selected.from) ?? rows[0];
        if (row === undefined) {
          closeTimeline();
          return;
        }
        timelineRow.value = row;
      }
      await fetchTimeline(selected.slotId);
    };

    const open = async (): Promise<void> => {
      isOpen.value = true;
      await fetch();
    };

    const close = () => {
      isOpen.value = false;
      closeTimeline();
    };

    const refresh = async (): Promise<void> => {
      if (isOpen.value) {
        await fetch();
        await reloadTimeline();
      }
    };

    const clear = () => {
      pace.value = null;
      historyUnavailable.value = false;
      isOpen.value = false;
      closeTimeline();
    };

    return {
      pace,
      showWithoutRange,
      loading,
      historyUnavailable,
      isOpen,
      timelineRow,
      timeline,
      timelineLoading,
      timelineError,
      visibleSlots,
      visibleGames,
      fetch,
      fetchTimeline,
      openTimeline,
      closeTimeline,
      open,
      close,
      refresh,
      clear,
    };
  },
  { persist: { pick: ['showWithoutRange'] } },
);
