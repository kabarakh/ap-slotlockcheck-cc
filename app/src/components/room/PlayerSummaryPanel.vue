<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import InputText from 'primevue/inputtext';
import { useTableFiltersStore } from '@/stores/table-filters';

const { playerText, filteredPlayers } = storeToRefs(useTableFiltersStore());
const { t } = useI18n();
</script>

<template>
  <section>
    <div class="app-toolbar">
      <InputText v-model="playerText" :placeholder="t('filters.search')" size="small" />
    </div>
    <DataTable
      :value="filteredPlayers"
      data-key="key"
      sort-field="name"
      :sort-order="1"
      removable-sort
      striped-rows
      size="small"
      data-testid="players-table"
    >
      <template #empty>{{ t('players.empty') }}</template>
      <Column field="name" :header="t('players.columns.name')" sortable />
      <Column field="slotCount" :header="t('players.columns.slots')" sortable />
      <Column field="unlockedCount" :header="t('players.columns.unlocked')" sortable />
      <Column field="goaledCount" :header="t('players.columns.goaled')" sortable />
      <Column field="lockedCount" :header="t('players.columns.locked')" sortable />
      <Column field="warningCount" :header="t('players.columns.warnings')" sortable />
    </DataTable>
  </section>
</template>
