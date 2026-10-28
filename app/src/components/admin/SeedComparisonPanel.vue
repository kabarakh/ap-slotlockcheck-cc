<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Message from 'primevue/message';

import { useSeedStore } from '@/stores/seed';

const seedStore = useSeedStore();
const { comparison, comparing } = storeToRefs(seedStore);
const { t } = useI18n();
</script>

<template>
  <section class="seed-comparison-panel">
    <h2>{{ t('seed.comparison.title') }}</h2>
    <p class="app-muted">{{ t('seed.comparison.intro') }}</p>
    <div>
      <Button
        :label="t('seed.comparison.compare')"
        icon="pi pi-sync"
        :loading="comparing"
        data-testid="seed-compare"
        @click="seedStore.compare()"
      />
    </div>
    <template v-if="comparison">
      <dl class="seed-data" data-testid="seed-comparison">
        <dt>{{ t('seed.comparison.uploadedSeed') }}</dt>
        <dd>{{ comparison.uploadedSeedName ?? t('seed.comparison.none') }}</dd>
        <dt>{{ t('seed.comparison.serverSeed') }}</dt>
        <dd>{{ comparison.serverSeedName ?? t('seed.comparison.none') }}</dd>
      </dl>
      <Message v-if="comparison.serverError" severity="warn">{{ t(`errors.${comparison.serverError}`) }}</Message>
      <Message v-if="comparison.uploadedSeedName === null" severity="info">{{ t('seed.comparison.noFile') }}</Message>
      <Message v-if="comparison.matches === true" severity="success" data-testid="seed-comparison-result">
        {{ t('seed.comparison.matches') }}
      </Message>
      <Message v-if="comparison.matches === false" severity="error" data-testid="seed-comparison-result">
        {{ t('seed.comparison.different') }}
      </Message>
    </template>
  </section>
</template>

<style scoped>
.seed-comparison-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 2rem;
}

.seed-data {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  margin: 0;
}

.seed-data dd {
  margin: 0;
  font-family: monospace;
}
</style>
