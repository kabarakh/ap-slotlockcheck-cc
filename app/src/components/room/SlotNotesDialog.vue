<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Textarea from 'primevue/textarea';

import { useCurrentRoomStore } from '@/stores/current-room';
import { useSlotNotesStore } from '@/stores/slot-notes';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const notesStore = useSlotNotesStore();
const { draft, busy } = storeToRefs(notesStore);
const { slotById } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

const maxLength = 10_000;

const visible = computed({
  get: () => ui.openDialogName === 'slotNotes',
  set: (value: boolean) => {
    if (!value) {
      ui.closeDialog();
    }
  },
});
const slot = computed(() => (draft.value.slotId === null ? undefined : slotById.value.get(draft.value.slotId)));
const header = computed(() => t('notes.editTitle', { slot: slot.value?.name ?? '' }));
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="header" class="slot-notes-dialog">
    <form class="app-form" @submit.prevent="notesStore.save()">
      <p v-if="slot?.notes" class="app-muted cheese-note">
        <strong>{{ t('notes.cheese') }}:</strong> {{ slot.notes }}
      </p>
      <label class="app-field">
        {{ t('notes.public') }}
        <Textarea
          v-model="draft.publicText"
          rows="3"
          auto-resize
          :maxlength="maxLength"
          data-testid="slot-note-public"
        />
        <small class="app-muted">{{ t('notes.publicHint') }}</small>
      </label>
      <label class="app-field">
        {{ t('notes.internal') }}
        <Textarea
          v-model="draft.internalText"
          rows="3"
          auto-resize
          :maxlength="maxLength"
          data-testid="slot-note-internal"
        />
        <small class="app-muted">{{ t('notes.internalHint') }}</small>
      </label>
      <div class="app-toolbar">
        <Button type="submit" :label="t('common.save')" :loading="busy" data-testid="save-slot-notes" />
        <Button :label="t('common.cancel')" text @click="ui.closeDialog()" />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
.slot-notes-dialog {
  width: min(40rem, 95vw);
}

.cheese-note {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
