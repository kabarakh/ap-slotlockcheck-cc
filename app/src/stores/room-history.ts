import { defineStore } from 'pinia';
import { ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { CHECKS_HISTORY_NOT_AVAILABLE } from './pace';
import { useStatisticsFilterStore } from './statistics-filter';
import { useUiStore } from './ui';
import { api, ApiRequestError, unwrap } from '@/api/client';
import type { RoomHistory } from '@/api/types';

export const useRoomHistoryStore = defineStore('room-history', () => {
  const history = ref<RoomHistory | null>(null);
  const loading = ref(false);
  const unavailable = ref(false);
  const openCount = ref(0);

  const fetch = async (): Promise<void> => {
    const slug = useCurrentRoomStore().slug;
    if (!slug) {
      history.value = null;
      return;
    }
    loading.value = true;
    try {
      const slotIds = useStatisticsFilterStore().historySlotIds;
      const result = await unwrap(
        api.GET('/api/rooms/{slug}/statistics/history', { params: { path: { slug }, query: { slotIds } } }),
      );
      if (JSON.stringify(slotIds) === JSON.stringify(useStatisticsFilterStore().historySlotIds)) {
        history.value = result;
      }
      unavailable.value = false;
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === CHECKS_HISTORY_NOT_AVAILABLE) {
        history.value = null;
        unavailable.value = true;
      } else {
        useUiStore().notifyError(error);
      }
    } finally {
      loading.value = false;
    }
  };

  const open = async (): Promise<void> => {
    openCount.value += 1;
    if (history.value === null) {
      await fetch();
    }
  };

  const close = () => {
    openCount.value = Math.max(0, openCount.value - 1);
  };

  const refresh = async (): Promise<void> => {
    if (openCount.value > 0) {
      await fetch();
    } else {
      history.value = null;
    }
  };

  const clear = () => {
    history.value = null;
    unavailable.value = false;
    openCount.value = 0;
  };

  return { history, loading, unavailable, fetch, open, close, refresh, clear };
});
