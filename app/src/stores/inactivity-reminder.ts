import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useInactivityStore } from './inactivity';
import { useUiStore } from './ui';
import {
  buildInactivityReminderMessages,
  ENGLISH_INACTIVITY_REMINDER_TEXTS,
  inactivityReminderEntries,
  type InactivityLevelFilter,
} from '@/domain/inactivity-message';

export interface InactivityReminderDraft {
  levels: InactivityLevelFilter;
  pings: boolean;
}

export const useInactivityReminderStore = defineStore(
  'inactivityReminder',
  () => {
    const draft = ref<InactivityReminderDraft>({ levels: 'all', pings: true });

    const entriesFor = (filter: InactivityLevelFilter, slotId: number | null = null) => {
      const inactivity = useInactivityStore();
      const slots = useCurrentRoomStore().slots.filter((slot) => slotId === null || slot.id === slotId);
      return inactivityReminderEntries(slots, inactivity.hoursBySlotId, inactivity.levelBySlotId, filter);
    };

    const entries = computed(() => entriesFor(draft.value.levels));

    const levelCounts = computed(() => {
      const all = entriesFor('all');
      return {
        yellow: all.filter((entry) => entry.level === 'yellow').length,
        red: all.filter((entry) => entry.level === 'red').length,
      };
    });

    const messages = computed(() =>
      buildInactivityReminderMessages(entries.value, draft.value.pings, ENGLISH_INACTIVITY_REMINDER_TEXTS),
    );

    const writeToClipboard = async (message: string | undefined): Promise<void> => {
      if (message !== undefined) {
        await navigator.clipboard.writeText(message);
        useUiStore().notify('success', 'reminder.copied');
      }
    };

    const copy = async (index: number): Promise<void> => {
      await writeToClipboard(messages.value[index]);
    };

    const canRemind = (slotId: number): boolean => entriesFor('all', slotId).length > 0;

    const copyForSlot = async (slotId: number): Promise<void> => {
      const [message] = buildInactivityReminderMessages(
        entriesFor('all', slotId),
        draft.value.pings,
        ENGLISH_INACTIVITY_REMINDER_TEXTS,
      );
      await writeToClipboard(message);
    };

    return { draft, entries, levelCounts, messages, copy, canRemind, copyForSlot };
  },
  { persist: { pick: ['draft'] } },
);
