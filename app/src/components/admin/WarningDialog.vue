<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';

import { useCurrentRoomStore } from '@/stores/current-room';
import { useUiStore } from '@/stores/ui';
import { useWarningsStore } from '@/stores/warnings';

const ui = useUiStore();
const warningsStore = useWarningsStore();
const { draft, canSave, busy } = storeToRefs(warningsStore);
const { playableSlots } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

const visible = computed({
  get: () => ui.openDialogName === 'warning',
  set: (value: boolean) => {
    if (!value) {
      ui.closeDialog();
    }
  },
});
const slotOptions = computed(() =>
  playableSlots.value.map((slot) => ({
    id: slot.id,
    label: `#${slot.position} ${slot.name}${slot.discordName ? ` (${slot.discordName})` : ''}`,
  })),
);
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="t('warnings.add')" class="warning-dialog">
    <form class="app-form" @submit.prevent="warningsStore.save()">
      <label class="app-field">
        {{ t('warnings.columns.slot') }}
        <Select
          v-model="draft.slotId"
          :options="slotOptions"
          option-label="label"
          option-value="id"
          filter
          data-testid="warning-slot"
        />
      </label>
      <label class="app-field">
        {{ t('warnings.columns.date') }}
        <DatePicker v-model="draft.date" show-time hour-format="24" />
      </label>
      <label class="app-field">
        {{ t('warnings.columns.text') }}
        <Textarea v-model="draft.text" rows="4" auto-resize data-testid="warning-text" />
      </label>
      <div class="app-toolbar">
        <Button
          type="submit"
          :label="t('common.save')"
          :disabled="!canSave"
          :loading="busy"
          data-testid="save-warning"
        />
        <Button :label="t('common.cancel')" text @click="ui.closeDialog()" />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
.warning-dialog {
  width: min(40rem, 95vw);
}
</style>
