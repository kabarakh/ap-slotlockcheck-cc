import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useUiStore } from './ui';
import { api, unwrap } from '@/api/client';
import type { RoomListEntry } from '@/api/types';

export const useRoomsStore = defineStore('rooms', () => {
  const rooms = ref<RoomListEntry[]>([]);
  const loading = ref(false);

  const sortedRooms = computed(() => [...rooms.value].sort((a, b) => a.title.localeCompare(b.title)));

  const fetchRooms = async (): Promise<void> => {
    loading.value = true;
    try {
      rooms.value = await unwrap(api.GET('/api/rooms'));
    } catch (error) {
      useUiStore().notifyError(error);
    } finally {
      loading.value = false;
    }
  };

  return { rooms, loading, sortedRooms, fetchRooms };
});
