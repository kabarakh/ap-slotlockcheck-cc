import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';
import { api, unwrap } from '@/api/client';
import type { InternalNote, SlotNoteKind } from '@/api/types';

export interface SlotNotesDraft {
  slotId: number | null;
  publicText: string;
  internalText: string;
}

export const useSlotNotesStore = defineStore('slotNotes', () => {
  const internalNotes = ref<InternalNote[]>([]);
  const draft = ref<SlotNotesDraft>({ slotId: null, publicText: '', internalText: '' });
  const busy = ref(false);

  const internalBySlotId = computed(() => new Map(internalNotes.value.map((note) => [note.slotId, note])));

  const canEdit = computed(() => {
    const room = useCurrentRoomStore();
    return room.isHelper && !room.isArchived;
  });

  const slug = () => useCurrentRoomStore().slug ?? '';

  const clear = () => {
    internalNotes.value = [];
  };

  const fetchInternal = async (): Promise<void> => {
    try {
      internalNotes.value = await unwrap(
        api.GET('/api/rooms/{slug}/notes/internal', { params: { path: { slug: slug() } } }),
      );
    } catch (error) {
      useUiStore().notifyError(error);
    }
  };

  const publicTextOf = (slotId: number): string => useCurrentRoomStore().slotById.get(slotId)?.staffNote?.text ?? '';
  const internalTextOf = (slotId: number): string => internalBySlotId.value.get(slotId)?.text ?? '';

  const startEdit = (slotId: number) => {
    draft.value = { slotId, publicText: publicTextOf(slotId), internalText: internalTextOf(slotId) };
    useUiStore().openDialog('slotNotes');
  };

  const saveKind = async (slotId: number, kind: SlotNoteKind, text: string): Promise<void> => {
    await unwrap(
      api.PUT('/api/rooms/{slug}/slots/{slotId}/notes/{kind}', {
        params: { path: { slug: slug(), slotId, kind } },
        body: { text },
      }),
    );
  };

  const save = async (): Promise<void> => {
    const { slotId, publicText, internalText } = draft.value;
    if (slotId === null || busy.value) {
      return;
    }
    busy.value = true;
    try {
      if (publicText !== publicTextOf(slotId)) {
        await saveKind(slotId, 'public', publicText);
      }
      if (internalText !== internalTextOf(slotId)) {
        await saveKind(slotId, 'internal', internalText);
      }
      await fetchInternal();
      useUiStore().closeDialog();
      useUiStore().notify('success', 'notes.saved');
    } catch (error) {
      useUiStore().notifyError(error);
    } finally {
      busy.value = false;
    }
  };

  return { internalNotes, draft, busy, internalBySlotId, canEdit, clear, fetchInternal, startEdit, save };
});
