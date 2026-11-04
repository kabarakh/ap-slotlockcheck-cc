<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import MultiSelect from 'primevue/multiselect';

import { useStatisticsFilterStore } from '@/stores/statistics-filter';

const filter = useStatisticsFilterStore();
const { playerKeys, slotIds, isActive, includedSlotIds, playerOptions, slotOptions, ownPlayerKey } =
  storeToRefs(filter);
const { t } = useI18n();

const summary = computed(() => {
  const count = includedSlotIds.value?.size ?? 0;
  return t('statistics.filter.summary', { count }, count);
});
</script>

<template>
  <div class="statistics-filter" data-testid="statistics-filter">
    <span class="pi pi-filter app-muted" aria-hidden="true" />
    <MultiSelect
      v-model="playerKeys"
      :options="playerOptions"
      option-label="label"
      option-value="value"
      :placeholder="t('statistics.filter.players')"
      :max-selected-labels="2"
      :selected-items-label="t('statistics.filter.selectedPlayers', { count: playerKeys.length })"
      filter
      size="small"
      class="filter-select"
      data-testid="statistics-filter-players"
    />
    <MultiSelect
      v-model="slotIds"
      :options="slotOptions"
      option-label="label"
      option-value="value"
      :placeholder="t('statistics.filter.slots')"
      :max-selected-labels="2"
      :selected-items-label="t('statistics.filter.selectedSlots', { count: slotIds.length })"
      filter
      size="small"
      class="filter-select"
      data-testid="statistics-filter-slots"
    />
    <Button
      v-if="ownPlayerKey"
      :label="t('statistics.filter.mine')"
      icon="pi pi-user"
      size="small"
      text
      data-testid="statistics-filter-mine"
      @click="filter.showOwn()"
    />
    <template v-if="isActive">
      <span class="app-muted filter-summary" data-testid="statistics-filter-summary">{{ summary }}</span>
      <Button
        :label="t('statistics.filter.clear')"
        icon="pi pi-times"
        size="small"
        severity="secondary"
        text
        data-testid="statistics-filter-clear"
        @click="filter.clear()"
      />
    </template>
  </div>
</template>

<style scoped>
.statistics-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.filter-select {
  min-width: 12rem;
  max-width: 20rem;
}

.filter-summary {
  font-size: 0.875rem;
}
</style>
