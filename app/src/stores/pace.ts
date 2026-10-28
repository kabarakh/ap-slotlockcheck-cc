import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';
import { api, ApiRequestError, unwrap } from '@/api/client';
import type { RoomPace } from '@/api/types';

export const CHECKS_HISTORY_NOT_AVAILABLE = 'CHECKS_HISTORY_NOT_AVAILABLE';

export const usePaceStore = defineStore(
  'pace',
  () => {
    const pace = ref<RoomPace | null>(null);
    const showWithoutRange = ref(false);
    const loading = ref(false);
    const historyUnavailable = ref(false);
    const isOpen = ref(false);

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

    const open = async (): Promise<void> => {
      isOpen.value = true;
      await fetch();
    };

    const close = () => {
      isOpen.value = false;
    };

    const refresh = async (): Promise<void> => {
      if (isOpen.value) {
        await fetch();
      }
    };

    const clear = () => {
      pace.value = null;
      historyUnavailable.value = false;
      isOpen.value = false;
    };

    return {
      pace,
      showWithoutRange,
      loading,
      historyUnavailable,
      isOpen,
      visibleSlots,
      visibleGames,
      fetch,
      open,
      close,
      refresh,
      clear,
    };
  },
  { persist: { pick: ['showWithoutRange'] } },
);
