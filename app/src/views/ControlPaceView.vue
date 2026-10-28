<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';

import GamePaceTable from '@/components/ui/GamePaceTable.vue';
import SlotPaceTable from '@/components/ui/SlotPaceTable.vue';

import { CHECKS_HISTORY_NOT_AVAILABLE, usePaceStore } from '@/stores/pace';

const paceStore = usePaceStore();
const { pace, showWithoutRange, loading, historyUnavailable, visibleSlots, visibleGames } = storeToRefs(paceStore);
const { t, d } = useI18n();

const signalsText = computed(() =>
  pace.value?.signalsFrom
    ? t('pace.signalsFrom', { time: d(new Date(pace.value.signalsFrom), 'dateTime') })
    : t('pace.noSignals'),
);

onMounted(() => paceStore.open());
onUnmounted(() => paceStore.close());
</script>

<template>
  <section class="pace">
    <div class="app-toolbar">
      <h2>{{ t('pace.title') }}</h2>
      <span class="app-spacer" />
      <label class="app-toolbar">
        <Checkbox v-model="showWithoutRange" binary data-testid="pace-show-without-range" />
        {{ t('pace.showWithoutRange') }}
      </label>
    </div>
    <Message v-if="historyUnavailable" severity="warn" :closable="false" data-testid="pace-unavailable">
      {{ t(`errors.${CHECKS_HISTORY_NOT_AVAILABLE}`) }}
    </Message>
    <ProgressSpinner v-else-if="loading && !pace" />
    <template v-else-if="pace">
      <div class="app-muted" data-testid="pace-hint">
        <p>{{ signalsText }}</p>
        <p>
          {{ t('pace.limits', { minutes: pace.limits.breakLimitMinutes, checks: pace.limits.bulkLimitChecks }) }}
          {{ t('pace.minimum') }}
        </p>
      </div>
      <h3>{{ t('pace.slotsTitle') }}</h3>
      <SlotPaceTable :rows="visibleSlots" />
      <h3>{{ t('pace.gamesTitle') }}</h3>
      <p class="app-muted">{{ t('pace.compare') }}</p>
      <GamePaceTable :games="visibleGames" />
    </template>
  </section>
</template>

<style scoped>
.pace {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pace h2,
.pace h3,
.pace p {
  margin: 0;
}
</style>
