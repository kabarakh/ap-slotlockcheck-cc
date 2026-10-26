import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { api, unwrap } from '@/api/client';
import type { Warning } from '@/api/types';
import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';

export interface WarningDraft {
  slotId: number | null;
  date: Date;
  text: string;
}

export const useWarningsStore = defineStore('warnings', () => {
  const warnings = ref<Warning[]>([]);
  const draft = ref<WarningDraft>({ slotId: null, date: new Date(), text: '' });
  const busy = ref(false);

  const canSave = computed(() => draft.value.slotId !== null && draft.value.text.trim().length > 0 && !busy.value);

  const countBySlotId = computed(() => {
    const counts = new Map<number, number>();
    for (const warning of warnings.value) {
      counts.set(warning.slotId, (counts.get(warning.slotId) ?? 0) + 1);
    }
    return counts;
  });

  const clear = () => {
    warnings.value = [];
  };

  const slugPath = () => ({ params: { path: { slug: useCurrentRoomStore().slug ?? '' } } });

  const startDraft = (slotId: number | null = null) => {
    draft.value = { slotId, date: new Date(), text: '' };
    useUiStore().openDialog('warning');
  };

  const fetch = async (): Promise<void> => {
    try {
      warnings.value = await unwrap(api.GET('/api/rooms/{slug}/warnings', slugPath()));
    } catch (error) {
      useUiStore().notifyError(error);
    }
  };

  const save = async (): Promise<void> => {
    if (!canSave.value || draft.value.slotId === null) {
      return;
    }
    busy.value = true;
    try {
      warnings.value = await unwrap(
        api.POST('/api/rooms/{slug}/warnings', {
          ...slugPath(),
          body: { slotId: draft.value.slotId, date: draft.value.date.toISOString(), text: draft.value.text.trim() },
        }),
      );
      useUiStore().closeDialog();
      useUiStore().notify('success', 'warnings.saved');
    } catch (error) {
      useUiStore().notifyError(error);
    } finally {
      busy.value = false;
    }
  };

  const remove = async (id: number): Promise<void> => {
    try {
      warnings.value = await unwrap(
        api.DELETE('/api/rooms/{slug}/warnings/{id}', {
          params: { path: { slug: useCurrentRoomStore().slug ?? '', id } },
        }),
      );
    } catch (error) {
      useUiStore().notifyError(error);
    }
  };

  return { warnings, draft, busy, canSave, countBySlotId, clear, startDraft, fetch, save, remove };
});
