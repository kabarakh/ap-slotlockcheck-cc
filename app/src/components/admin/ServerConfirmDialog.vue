<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Dialog from 'primevue/dialog';

import { useServerAdminStore } from '@/stores/server-admin';
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const serverAdmin = useServerAdminStore();
const { pending } = storeToRefs(serverAdmin);
const { t } = useI18n();

const visible = computed({
  get: () => ui.openDialogName === 'serverConfirm' && pending.value !== null,
  set: (value: boolean) => {
    if (!value) {
      serverAdmin.cancelPending();
    }
  },
});

const text = computed(() => {
  const command = pending.value;
  if (!command) {
    return '';
  }
  if (command.kind === 'releaseSpheres') {
    return t('server.confirm.releaseSpheres', {
      from: Math.min(command.draft.fromSphere, command.draft.toSphere),
      to: Math.max(command.draft.fromSphere, command.draft.toSphere),
      mode: t(`server.releaseModes.${command.draft.mode}`),
      count: command.preview.locationCount,
      progression: command.preview.progressionCount,
    });
  }
  return t(`server.confirm.${command.kind}`, { slot: command.slotName });
});
const canConfirm = computed(() => pending.value?.kind !== 'releaseSpheres' || pending.value.preview.locationCount > 0);
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="t('server.confirm.title')">
    <p data-testid="server-confirm-text">{{ text }}</p>
    <p class="app-muted">{{ t('server.confirm.irreversible') }}</p>
    <div class="app-toolbar">
      <Button
        :label="t('server.confirm.run')"
        severity="danger"
        :disabled="!canConfirm"
        data-testid="server-confirm"
        @click="serverAdmin.confirmPending()"
      />
      <Button :label="t('common.cancel')" text @click="serverAdmin.cancelPending()" />
    </div>
  </Dialog>
</template>
