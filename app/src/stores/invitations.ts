import { ref } from 'vue';
import { defineStore } from 'pinia';

import { api, unwrap } from '@/api/client';
import type { AdminRole } from '@/api/types';
import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';

export type InvitationState = 'idle' | 'accepting' | 'accepted' | 'failed';

export const useInvitationsStore = defineStore('invitations', () => {
  const role = ref<AdminRole>('admin');
  const createdUrl = ref<string | null>(null);
  const createdValidUntil = ref<string | null>(null);
  const state = ref<InvitationState>('idle');
  const acceptedSlug = ref<string | null>(null);

  const create = async (): Promise<void> => {
    try {
      const invitation = await unwrap(
        api.POST('/api/rooms/{slug}/invitations', {
          params: { path: { slug: useCurrentRoomStore().slug ?? '' } },
          body: { role: role.value },
        }),
      );
      createdUrl.value = invitation.url;
      createdValidUntil.value = invitation.validUntil;
    } catch (error) {
      useUiStore().notifyError(error);
    }
  };

  const copyCreatedUrl = async (): Promise<void> => {
    if (createdUrl.value) {
      await navigator.clipboard.writeText(createdUrl.value);
      useUiStore().notify('success', 'invitations.copied');
    }
  };

  const accept = async (token: string): Promise<string | null> => {
    state.value = 'accepting';
    try {
      const result = await unwrap(api.POST('/api/invitations/{token}/accept', { params: { path: { token } } }));
      acceptedSlug.value = result.slug;
      state.value = 'accepted';
      return result.slug;
    } catch (error) {
      state.value = 'failed';
      useUiStore().notifyError(error);
      return null;
    }
  };

  return { role, createdUrl, createdValidUntil, state, acceptedSlug, create, copyCreatedUrl, accept };
});
