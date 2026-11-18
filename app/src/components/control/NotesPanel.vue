<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import Checkbox from 'primevue/checkbox';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';

import SlotNotesDialog from '@/components/room/SlotNotesDialog.vue';
import StaffNoteText from '@/components/ui/StaffNoteText.vue';

import type { SlotRow } from '@/api/types';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useSlotNotesStore } from '@/stores/slot-notes';

const notesStore = useSlotNotesStore();
const { internalBySlotId, canEdit } = storeToRefs(notesStore);
const { playableSlots, isArchived } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

const onlyWithNotes = ref(false);

const hasNote = (slot: SlotRow): boolean =>
  slot.notes.length > 0 ||
  (slot.staffNote?.text.length ?? 0) > 0 ||
  (internalBySlotId.value.get(slot.id)?.text.length ?? 0) > 0;

const rows = computed(() => (onlyWithNotes.value ? playableSlots.value.filter(hasNote) : playableSlots.value));

onMounted(() => notesStore.fetchInternal());
</script>

<template>
  <section class="notes-panel">
    <Message v-if="isArchived" severity="info" size="small" data-testid="notes-archived">
      {{ t('notes.archived') }}
    </Message>
    <label class="app-toolbar">
      <Checkbox v-model="onlyWithNotes" binary data-testid="notes-only-with-notes" />
      {{ t('notes.onlyWithNotes') }}
    </label>
    <DataTable :value="rows" data-key="id" size="small" striped-rows data-testid="notes-table">
      <template #empty>{{ t('notes.empty') }}</template>
      <Column field="position" :header="t('slot.columns.position')" sortable />
      <Column field="name" :header="t('slot.columns.name')" sortable />
      <Column field="discordName" :header="t('slot.columns.discord')" sortable />
      <Column :header="t('notes.cheese')">
        <template #body="{ data }">
          <span class="note-text">{{ (data as SlotRow).notes }}</span>
        </template>
      </Column>
      <Column :header="t('notes.public')">
        <template #body="{ data }">
          <StaffNoteText :note="(data as SlotRow).staffNote" kind="public" />
        </template>
      </Column>
      <Column :header="t('notes.internal')">
        <template #body="{ data }">
          <StaffNoteText :note="internalBySlotId.get((data as SlotRow).id)" kind="internal" />
        </template>
      </Column>
      <Column v-if="canEdit">
        <template #body="{ data }">
          <button
            v-tooltip.top="t('notes.edit')"
            type="button"
            class="edit-notes"
            :aria-label="t('notes.edit')"
            data-testid="edit-notes"
            @click="notesStore.startEdit((data as SlotRow).id)"
          >
            <i class="pi pi-pencil" />
          </button>
        </template>
      </Column>
    </DataTable>
    <SlotNotesDialog />
  </section>
</template>

<style scoped>
.notes-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.note-text {
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.edit-notes {
  border: none;
  background: none;
  padding: 0;
  color: var(--p-text-muted-color);
  cursor: pointer;
}

.edit-notes:hover {
  color: var(--p-primary-color);
}
</style>
