import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { usePreferredDark } from '@vueuse/core';
import { ApiRequestError } from '@/api/client';

export type Locale = 'de' | 'en';
export type ColorMode = 'system' | 'light' | 'dark';
export type MessageSeverity = 'success' | 'info' | 'warn' | 'error';

export interface UiMessage {
  id: number;
  severity: MessageSeverity;
  key: string;
  params: Record<string, string | number>;
}

export type DialogName = 'warning' | 'unlockTime';

export const useUiStore = defineStore(
  'ui',
  () => {
    const locale = ref<Locale>(navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en');
    const colorMode = ref<ColorMode>('system');
    const messages = ref<UiMessage[]>([]);
    const openDialogName = ref<DialogName | null>(null);
    const prefersDark = usePreferredDark();
    let nextMessageId = 1;

    const isDark = computed(() => colorMode.value === 'dark' || (colorMode.value === 'system' && prefersDark.value));

    const setLocale = (value: Locale) => {
      locale.value = value;
    };

    const setColorMode = (value: ColorMode) => {
      colorMode.value = value;
    };

    const notify = (severity: MessageSeverity, key: string, params: Record<string, string | number> = {}) => {
      messages.value = [...messages.value, { id: nextMessageId++, severity, key, params }];
    };

    const notifyError = (error: unknown) => {
      if (error instanceof ApiRequestError) {
        notify('error', `errors.${error.code}`, { status: error.status, message: error.message });
      } else {
        notify('error', 'errors.UNKNOWN', { message: error instanceof Error ? error.message : String(error) });
      }
    };

    const takeMessages = (): UiMessage[] => {
      const taken = messages.value;
      messages.value = [];
      return taken;
    };

    const openDialog = (name: DialogName) => {
      openDialogName.value = name;
    };

    const closeDialog = () => {
      openDialogName.value = null;
    };

    return {
      locale,
      colorMode,
      messages,
      openDialogName,
      isDark,
      setLocale,
      setColorMode,
      notify,
      notifyError,
      takeMessages,
      openDialog,
      closeDialog,
    };
  },
  { persist: { pick: ['locale', 'colorMode'] } },
);
