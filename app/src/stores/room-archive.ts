import { defineStore } from 'pinia';
import { ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';
import { api, unwrap } from '@/api/client';
import type { RoomDetail } from '@/api/types';

export const useRoomArchiveStore = defineStore('roomArchive', () => {
  const confirming = ref(false);
  const busy = ref(false);

  const slugPath = () => ({ params: { path: { slug: useCurrentRoomStore().slug ?? '' } } });

  const run = async (action: () => Promise<RoomDetail>, successKey: string): Promise<boolean> => {
    busy.value = true;
    try {
      useCurrentRoomStore().room = await action();
      useUiStore().notify('success', successKey);
      return true;
    } catch (error) {
      useUiStore().notifyError(error);
      return false;
    } finally {
      busy.value = false;
      confirming.value = false;
    }
  };

  const ask = () => {
    confirming.value = true;
  };

  const cancel = () => {
    confirming.value = false;
  };

  const archive = () => run(() => unwrap(api.POST('/api/rooms/{slug}/archive', slugPath())), 'archive.archived');

  const reopen = () => run(() => unwrap(api.DELETE('/api/rooms/{slug}/archive', slugPath())), 'archive.reopened');

  return { confirming, busy, ask, cancel, archive, reopen };
});
