import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useUiStore } from './ui';
import { api, unwrap } from '@/api/client';
import type { AuthUser } from '@/api/types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const loaded = ref(false);
  let loading: Promise<void> | null = null;

  const isLoggedIn = computed(() => user.value !== null);

  const fetchMe = async (): Promise<void> => {
    try {
      const session = await unwrap(api.GET('/api/auth/me'));
      user.value = session.user;
    } catch (error) {
      useUiStore().notifyError(error);
    } finally {
      loaded.value = true;
    }
  };

  const ensureLoaded = (): Promise<void> => {
    loading ??= fetchMe();
    return loading;
  };

  const login = (returnTo: string) => {
    window.location.assign(`/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const logout = async (): Promise<void> => {
    try {
      await unwrap(api.POST('/api/auth/logout'));
      user.value = null;
    } catch (error) {
      useUiStore().notifyError(error);
    }
  };

  return { user, loaded, isLoggedIn, fetchMe, ensureLoaded, login, logout };
});
