import { defineStore } from 'pinia';
import { ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';
import { api, unwrap } from '@/api/client';
import type { RoomDependencies } from '@/api/types';

export const useDependenciesStore = defineStore('dependencies', () => {
  const dependencies = ref<RoomDependencies | null>(null);
  const loading = ref(false);
  const isOpen = ref(false);

  const fetch = async (): Promise<void> => {
    const slug = useCurrentRoomStore().slug;
    if (!slug) {
      dependencies.value = null;
      return;
    }
    loading.value = true;
    try {
      dependencies.value = await unwrap(
        api.GET('/api/rooms/{slug}/statistics/dependencies', { params: { path: { slug } } }),
      );
    } catch (error) {
      useUiStore().notifyError(error);
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
    dependencies.value = null;
    isOpen.value = false;
  };

  return { dependencies, loading, isOpen, fetch, open, close, refresh, clear };
});
