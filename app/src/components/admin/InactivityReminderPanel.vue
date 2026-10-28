<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';

import type { InactivityLevelFilter } from '@/domain/inactivity-message';
import { useInactivityReminderStore } from '@/stores/inactivity-reminder';

const reminder = useInactivityReminderStore();
const { draft, messages } = storeToRefs(reminder);
const { t } = useI18n();

const levelOptions = computed(() =>
  (['all', 'yellow', 'red'] as InactivityLevelFilter[]).map((value) => ({
    value,
    label: t(`reminder.levels.${value}`),
  })),
);
</script>

<template>
  <section class="reminder">
    <h2>{{ t('reminder.title') }}</h2>
    <p class="app-muted">{{ t('reminder.intro') }}</p>
    <div class="app-toolbar">
      <Select
        v-model="draft.levels"
        :options="levelOptions"
        option-label="label"
        option-value="value"
        size="small"
        data-testid="reminder-levels"
      />
      <label class="app-toolbar">
        <Checkbox v-model="draft.pings" binary data-testid="reminder-pings" />
        {{ t('reminder.pings') }}
      </label>
    </div>
    <Message v-if="messages.length === 0" severity="success">{{ t('reminder.nothingInactive') }}</Message>
    <div v-for="(message, index) in messages" :key="index" class="reminder-message" data-testid="reminder-message">
      <div class="app-toolbar">
        <strong>{{ t('reminder.messageNumber', { number: index + 1, count: messages.length }) }}</strong>
        <Button
          :label="t('reminder.copy')"
          icon="pi pi-copy"
          size="small"
          text
          :data-testid="`reminder-copy-${index}`"
          @click="reminder.copy(index)"
        />
      </div>
      <Textarea :model-value="message" readonly auto-resize rows="4" class="reminder-text" />
    </div>
  </section>
</template>

<style scoped>
.reminder {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.reminder-message {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reminder-text {
  width: 100%;
  font-family: monospace;
}
</style>
