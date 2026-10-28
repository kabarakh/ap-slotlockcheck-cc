<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';

import DateTimeText from '@/components/ui/DateTimeText.vue';

import { useCurrentRoomStore } from '@/stores/current-room';
import { useSeedStore } from '@/stores/seed';

const seedStore = useSeedStore();
const { seed, differences, busy } = storeToRefs(seedStore);
const { room } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

const onFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    await seedStore.upload(file);
  }
  input.value = '';
};

onMounted(() => seedStore.fetch());
</script>

<template>
  <section class="seed-panel">
    <h2>{{ t('seed.title') }}</h2>
    <template v-if="seed">
      <dl class="seed-data" data-testid="seed-data">
        <dt>{{ t('seed.seedName') }}</dt>
        <dd>{{ seed.seedName }}</dd>
        <dt>{{ t('seed.version') }}</dt>
        <dd>{{ seed.archipelagoVersion }}</dd>
        <dt>{{ t('seed.locations') }}</dt>
        <dd>{{ seed.locationCount }}</dd>
        <dt>{{ t('seed.spheres') }}</dt>
        <dd>{{ seed.sphereCount }}</dd>
        <dt>{{ t('seed.uploaded') }}</dt>
        <dd><DateTimeText :value="seed.uploadedAt" />, {{ seed.uploadedByName }}</dd>
      </dl>
      <Message v-if="seed.unreachableLocationCount > 0" severity="info">
        {{ t('seed.unreachable', { count: seed.unreachableLocationCount }) }}
      </Message>
    </template>
    <template v-else-if="!room?.hasSeed">
      <p class="app-muted">{{ t('seed.intro') }}</p>
      <Message severity="warn">{{ t('seed.onlyOnce') }}</Message>
      <input type="file" accept=".archipelago,.zip" :disabled="busy" data-testid="seed-file" @change="onFileSelected" />
      <ProgressSpinner v-if="busy" class="seed-spinner" />
      <Message v-if="differences.length > 0" severity="error" data-testid="seed-differences">
        <p>{{ t('seed.differences') }}</p>
        <ul>
          <li v-for="difference in differences" :key="difference">{{ difference }}</li>
        </ul>
      </Message>
    </template>
  </section>
</template>

<style scoped>
.seed-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.seed-data {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  margin: 0;
}

.seed-data dd {
  margin: 0;
}

.seed-spinner {
  width: 2rem;
  height: 2rem;
}
</style>
