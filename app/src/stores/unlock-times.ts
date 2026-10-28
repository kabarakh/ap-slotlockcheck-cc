import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';
import { api, unwrap } from '@/api/client';
import type { UnlockTimeImportResult } from '@/api/types';

export interface UnlockTimeDraft {
  lockerSlotId: number;
  lockedSlotId: number;
  unlockTime: Date;
}

export const useUnlockTimesStore = defineStore('unlockTimes', () => {
  const draft = ref<UnlockTimeDraft | null>(null);
  const csv = ref('');
  const importResult = ref<UnlockTimeImportResult | null>(null);
  const busy = ref(false);

  const unlockedPairs = computed(() =>
    useCurrentRoomStore().sortedSlots.flatMap((slot) =>
      slot.locks
        .filter((lock) => lock.unlocked)
        .map((lock) => ({ slot, lock, key: `${lock.lockerSlotId}:${slot.id}` })),
    ),
  );

  const slugPath = () => ({ params: { path: { slug: useCurrentRoomStore().slug ?? '' } } });

  const startDraft = (lockerSlotId: number, lockedSlotId: number, current: string | null) => {
    draft.value = { lockerSlotId, lockedSlotId, unlockTime: current ? new Date(current) : new Date() };
    useUiStore().openDialog('unlockTime');
  };

  const saveDraft = async (): Promise<void> => {
    const current = draft.value;
    if (!current) {
      return;
    }
    busy.value = true;
    try {
      await unwrap(
        api.PUT('/api/rooms/{slug}/unlock-times', {
          ...slugPath(),
          body: {
            lockerSlotId: current.lockerSlotId,
            lockedSlotId: current.lockedSlotId,
            unlockTime: current.unlockTime.toISOString(),
          },
        }),
      );
      draft.value = null;
      useUiStore().closeDialog();
      useUiStore().notify('success', 'unlockTimes.saved');
    } catch (error) {
      useUiStore().notifyError(error);
    } finally {
      busy.value = false;
    }
  };

  const loadCsvFile = async (file: File): Promise<void> => {
    csv.value = await file.text();
  };

  const importCsv = async (): Promise<void> => {
    if (csv.value.trim().length === 0) {
      return;
    }
    busy.value = true;
    try {
      importResult.value = await unwrap(
        api.POST('/api/rooms/{slug}/unlock-times/csv', { ...slugPath(), body: { csv: csv.value } }),
      );
    } catch (error) {
      useUiStore().notifyError(error);
    } finally {
      busy.value = false;
    }
  };

  return { draft, csv, importResult, busy, unlockedPairs, startDraft, saveDraft, loadCsvFile, importCsv };
});
