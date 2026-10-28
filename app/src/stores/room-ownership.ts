import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useAdminStore } from './admin';
import { useAuthStore } from './auth';
import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';
import { api, unwrap } from '@/api/client';

export interface TransferDraft {
  discordId: string | null;
  stayAdmin: boolean;
}

export interface OwnerOption {
  discordId: string;
  name: string;
}

export const useRoomOwnershipStore = defineStore('roomOwnership', () => {
  const transferDraft = ref<TransferDraft>({ discordId: null, stayAdmin: true });
  const deleteTitle = ref('');
  const confirming = ref<'leave' | 'transfer' | null>(null);
  const busy = ref(false);

  const transferOptions = computed<OwnerOption[]>(() => {
    const ownDiscordId = useAuthStore().user?.discordId;
    const options = new Map<string, OwnerOption>();
    for (const admin of useAdminStore().admins) {
      options.set(admin.discordId, { discordId: admin.discordId, name: admin.name });
    }
    for (const slot of useCurrentRoomStore().slots) {
      if (slot.discordUserId && !options.has(slot.discordUserId)) {
        options.set(slot.discordUserId, {
          discordId: slot.discordUserId,
          name: slot.discordName ?? slot.discordUserId,
        });
      }
    }
    options.delete(ownDiscordId ?? '');
    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  const canDelete = computed(() => deleteTitle.value === useCurrentRoomStore().room?.title);

  const slugPath = () => ({ params: { path: { slug: useCurrentRoomStore().slug ?? '' } } });

  const run = async (action: () => Promise<unknown>, successKey: string): Promise<boolean> => {
    busy.value = true;
    try {
      await action();
      useUiStore().notify('success', successKey);
      return true;
    } catch (error) {
      useUiStore().notifyError(error);
      return false;
    } finally {
      busy.value = false;
      confirming.value = null;
    }
  };

  const ask = (action: 'leave' | 'transfer') => {
    confirming.value = action;
  };

  const cancel = () => {
    confirming.value = null;
  };

  const transfer = async (): Promise<boolean> => {
    const { discordId, stayAdmin } = transferDraft.value;
    if (!discordId) {
      return false;
    }
    const done = await run(
      () => unwrap(api.POST('/api/rooms/{slug}/owner', { ...slugPath(), body: { discordId, stayAdmin } })),
      'ownership.transferred',
    );
    if (done) {
      transferDraft.value = { discordId: null, stayAdmin: true };
      await useCurrentRoomStore().reload();
    }
    return done;
  };

  const leave = async (): Promise<boolean> => {
    const done = await run(() => unwrap(api.POST('/api/rooms/{slug}/leave', slugPath())), 'ownership.left');
    if (done) {
      await useCurrentRoomStore().reload();
    }
    return done;
  };

  const deleteRoom = async (): Promise<boolean> => {
    if (!canDelete.value) {
      return false;
    }
    const done = await run(
      () => unwrap(api.DELETE('/api/rooms/{slug}', { ...slugPath(), body: { title: deleteTitle.value } })),
      'ownership.deleted',
    );
    if (done) {
      deleteTitle.value = '';
      useCurrentRoomStore().close();
    }
    return done;
  };

  return {
    transferDraft,
    deleteTitle,
    confirming,
    busy,
    transferOptions,
    canDelete,
    ask,
    cancel,
    transfer,
    leave,
    deleteRoom,
  };
});
