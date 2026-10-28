<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import InputText from 'primevue/inputtext';

import SlotNameList from '@/components/ui/SlotNameList.vue';

import type { PlayerSummary } from '@/domain/summary';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useTableFiltersStore } from '@/stores/table-filters';

const { playerText, filteredPlayers } = storeToRefs(useTableFiltersStore());
const { isAdmin, hasSlotLock } = storeToRefs(useCurrentRoomStore());
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
      <Column v-if="hasSlotLock" field="unlockedCount" :header="t('players.columns.unlocked')" sortable>
        <template #body="{ data }">
          <SlotNameList :count="(data as PlayerSummary).unlockedCount" :names="(data as PlayerSummary).unlockedNames" />
        </template>
      </Column>
      <Column field="goaledCount" :header="t('players.columns.goaled')" sortable>
        <template #body="{ data }">
          <SlotNameList :count="(data as PlayerSummary).goaledCount" :names="(data as PlayerSummary).goaledNames" />
        </template>
      </Column>
      <Column v-if="hasSlotLock" field="lockedCount" :header="t('players.columns.locked')" sortable>
        <template #body="{ data }">
          <SlotNameList :count="(data as PlayerSummary).lockedCount" :names="(data as PlayerSummary).lockedNames" />
        </template>
      </Column>
      <Column v-if="isAdmin" field="warningCount" :header="t('players.columns.warnings')" sortable />
    </DataTable>
  </section>
</template>
