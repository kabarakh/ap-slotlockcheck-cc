<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputNumber from 'primevue/inputnumber';
import Message from 'primevue/message';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';

import type { CleanupSlotMode } from '@/api/types';
import { useSphereCleanupStore } from '@/stores/sphere-cleanup';

const cleanup = useSphereCleanupStore();
const { draft, messages, range, loading } = storeToRefs(cleanup);
const { t } = useI18n();

const slotModeOptions = computed(() =>
  (['all', 'progression'] as CleanupSlotMode[]).map((value) => ({ value, label: t(`cleanup.slotModes.${value}`) })),
);

const section = useTemplateRef<HTMLElement>('section');

onMounted(async () => {
  if (await cleanup.prepare()) {
    section.value?.scrollIntoView({ behavior: 'smooth' });
  }
});
</script>

<template>
  <section ref="section" class="cleanup">
    <h2>{{ t('cleanup.title') }}</h2>
    <p class="app-muted">{{ t('cleanup.intro') }}</p>
    <form class="app-toolbar" @submit.prevent="cleanup.fetch()">
      <label class="app-toolbar">
        {{ t('cleanup.from') }}
        <InputNumber
          v-model="draft.fromSphere"
          :min="0"
          size="small"
          input-class="sphere-input"
          data-testid="cleanup-from"
        />
      </label>
      <label class="app-toolbar">
        {{ t('cleanup.to') }}
        <InputNumber
          v-model="draft.toSphere"
          :min="0"
          size="small"
          input-class="sphere-input"
          data-testid="cleanup-to"
        />
      </label>
      <Select
        v-model="draft.slots"
        :options="slotModeOptions"
        option-label="label"
        option-value="value"
        size="small"
        data-testid="cleanup-slots"
      />
      <label class="app-toolbar">
        <Checkbox v-model="draft.excludeGoaled" binary />
        {{ t('spheres.excludeGoaled') }}
      </label>
      <label class="app-toolbar">
        <Checkbox v-model="draft.pings" binary data-testid="cleanup-pings" />
        {{ t('cleanup.pings') }}
      </label>
      <Button type="submit" :label="t('cleanup.create')" size="small" :loading="loading" data-testid="cleanup-create" />
    </form>
    <Message v-if="range && messages.length === 0" severity="success">{{ t('cleanup.nothingOpen') }}</Message>
    <div v-for="(message, index) in messages" :key="index" class="cleanup-message" data-testid="cleanup-message">
      <div class="app-toolbar">
        <strong>{{ t('cleanup.messageNumber', { number: index + 1, count: messages.length }) }}</strong>
        <Button
          :label="t('cleanup.copy')"
          icon="pi pi-copy"
          size="small"
          text
          :data-testid="`cleanup-copy-${index}`"
          @click="cleanup.copy(index)"
        />
      </div>
      <Textarea :model-value="message" readonly auto-resize rows="4" class="cleanup-text" />
    </div>
  </section>
</template>

<style scoped>
.cleanup {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.cleanup-message {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.cleanup-text {
  width: 100%;
  font-family: monospace;
}

:deep(.sphere-input) {
  width: 4.5rem;
}
</style>
