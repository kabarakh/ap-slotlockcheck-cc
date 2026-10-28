<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import Dialog from 'primevue/dialog';

import { useUiStore } from '@/stores/ui';
import { useUnlockTimesStore } from '@/stores/unlock-times';

const ui = useUiStore();
const unlockTimes = useUnlockTimesStore();
const { draft, busy } = storeToRefs(unlockTimes);
const { t } = useI18n();

const visible = computed({
  get: () => ui.openDialogName === 'unlockTime' && draft.value !== null,
  set: (value: boolean) => {
    if (!value) {
      ui.closeDialog();
    }
  },
});
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="t('unlockTimes.edit')">
    <form v-if="draft" class="app-form" @submit.prevent="unlockTimes.saveDraft()">
      <DatePicker v-model="draft.unlockTime" show-time hour-format="24" inline />
      <div class="app-toolbar">
        <Button type="submit" :label="t('common.save')" :loading="busy" />
        <Button :label="t('common.cancel')" text @click="ui.closeDialog()" />
      </div>
    </form>
  </Dialog>
</template>
