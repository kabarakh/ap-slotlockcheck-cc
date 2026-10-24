<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import Message from 'primevue/message';
import UnlockTreeChart from '@/components/ui/UnlockTreeChart.vue';
import { useStatisticsStore } from '@/stores/statistics';

const { unlockForest } = storeToRefs(useStatisticsStore());
const { t } = useI18n();
</script>

<template>
  <section class="unlock-tree-panel">
    <p class="app-muted">{{ t('unlockTree.intro') }}</p>
    <ul class="unlock-tree-legend">
      <li><span class="legend-dot legend-slotlock" />{{ t('unlockTree.legend.slotlock') }}</li>
      <li><span class="legend-dot legend-start" />{{ t('unlockTree.legend.start') }}</li>
      <li><span class="legend-dot" />{{ t('unlockTree.legend.unlocked') }}</li>
      <li><span class="legend-dot legend-partial" />{{ t('unlockTree.legend.partial') }}</li>
      <li><span class="legend-dot legend-goaled" />{{ t('unlockTree.legend.goaled') }}</li>
    </ul>
    <Message v-if="unlockForest.roots.length === 0" severity="info">{{ t('unlockTree.empty') }}</Message>
    <UnlockTreeChart v-else :roots="unlockForest.roots" />
    <p v-if="unlockForest.lockedSlotCount > 0" class="app-muted">
      {{ t('unlockTree.stillLocked', { count: unlockForest.lockedSlotCount }) }}
    </p>
  </section>
</template>

<style scoped>
.unlock-tree-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.unlock-tree-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
}

.unlock-tree-legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.legend-dot {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
  border: 2px solid var(--p-surface-500);
  background: var(--p-content-background);
}

.legend-slotlock {
  background: var(--p-primary-color);
  border-color: var(--p-primary-color);
}

.legend-start {
  border-color: var(--p-sky-500);
}

.legend-partial {
  border-color: var(--p-orange-500);
  border-style: dashed;
}

.legend-goaled {
  background: var(--p-green-500);
  border-color: var(--p-green-600);
}
</style>
