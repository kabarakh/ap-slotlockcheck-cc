<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Checkbox from 'primevue/checkbox';
import Message from 'primevue/message';

import UnlockTreeChart from '@/components/ui/UnlockTreeChart.vue';

import { useCurrentRoomStore } from '@/stores/current-room';
import { useStatisticsStore } from '@/stores/statistics';
import { useTableFiltersStore } from '@/stores/table-filters';

const { unlockForest } = storeToRefs(useStatisticsStore());
const { mySlots } = storeToRefs(useCurrentRoomStore());
const { highlightMySlots } = storeToRefs(useTableFiltersStore());
const highlightedIds = computed(() => new Set(highlightMySlots.value ? mySlots.value.map((slot) => slot.id) : []));
const { t } = useI18n();
</script>

<template>
  <section class="unlock-tree-panel">
    <p class="app-muted">{{ t('unlockTree.intro') }}</p>
    <label v-if="mySlots.length > 0" class="app-toolbar">
      <Checkbox v-model="highlightMySlots" binary data-testid="highlight-my-slots" />
      {{ t('unlockTree.highlightMySlots') }}
    </label>
    <ul class="unlock-tree-legend">
      <li><span class="legend-dot legend-slotlock" />{{ t('unlockTree.legend.slotlock') }}</li>
      <li><span class="legend-dot legend-start" />{{ t('unlockTree.legend.start') }}</li>
      <li><span class="legend-dot" />{{ t('unlockTree.legend.unlocked') }}</li>
      <li><span class="legend-dot legend-partial" />{{ t('unlockTree.legend.partial') }}</li>
      <li><span class="legend-dot legend-goaled" />{{ t('unlockTree.legend.goaled') }}</li>
      <li v-if="highlightedIds.size > 0"><span class="legend-dot legend-mine" />{{ t('unlockTree.legend.mine') }}</li>
    </ul>
    <Message v-if="unlockForest.roots.length === 0" severity="info">{{ t('unlockTree.empty') }}</Message>
    <UnlockTreeChart v-else :roots="unlockForest.roots" :highlighted-ids="highlightedIds" />
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

.legend-mine {
  box-shadow: 0 0 0 2px var(--p-yellow-500);
}
</style>
