<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import Toast from 'primevue/toast';
import { useToast } from 'primevue/usetoast';

import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
const toast = useToast();
const { t, te } = useI18n();

const MESSAGE_LIFE_MS = 6000;

watch(
  () => ui.messages.length,
  (count) => {
    if (count === 0) {
      return;
    }
    for (const message of ui.takeMessages()) {
      const key = te(message.key) ? message.key : 'errors.ERROR';
      toast.add({
        severity: message.severity,
        summary: t(`messages.${message.severity}`),
        detail: t(key, message.params),
        life: MESSAGE_LIFE_MS,
      });
    }
  },
  { immediate: true },
);
</script>

<template>
  <Toast position="bottom-right" />
</template>
