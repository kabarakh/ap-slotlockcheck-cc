<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import Column from 'primevue/column';
import DataTable, { type DataTableSortEvent } from 'primevue/datatable';

import type { GamePace } from '@/api/types';
import { formatDuration } from '@/domain/duration';
import { formatGameName } from '@/domain/game-name';
import { nextTableSort, type TableSort } from '@/domain/table-sort';

const props = defineProps<{ games: GamePace[] }>();
const { t, n } = useI18n();

const rows = computed(() => props.games.map((game) => ({ ...game, gameName: formatGameName(game.game) })));

type Row = (typeof rows.value)[number];

const sort = ref<TableSort>({ field: null, order: null });

const onSort = (event: DataTableSortEvent): void => {
  const field = typeof event.sortField === 'string' ? event.sortField : null;
  const order = event.sortOrder === 1 || event.sortOrder === -1 ? event.sortOrder : null;
  sort.value = nextTableSort(sort.value, { field, order }, []);
};

const decimal = (value: number | null): string => (value === null ? '' : n(value, 'decimal'));
</script>

<template>
  <DataTable
    :value="rows"
    data-key="game"
    :sort-field="sort.field ?? undefined"
    :sort-order="sort.order ?? undefined"
    removable-sort
    striped-rows
    size="small"
    class="game-pace-table"
    data-testid="game-pace-table"
    @sort="onSort"
  >
    <template #empty>{{ t('pace.emptyGames') }}</template>
    <Column field="gameName" :header="t('pace.columns.game')" sortable>
      <template #body="{ data }">
        <span :title="(data as Row).game">{{ (data as Row).gameName }}</span>
      </template>
    </Column>
    <Column field="slotCount" :header="t('pace.columns.slotCount')" sortable />
    <Column field="activeMinutes" :header="t('pace.columns.activeTime')" sortable>
      <template #body="{ data }">
        <span class="nowrap">{{ formatDuration((data as Row).activeMinutes) }}</span>
      </template>
    </Column>
    <Column field="checks" :header="t('pace.columns.checks')" sortable />
    <Column field="checksPerHour" :header="t('pace.columns.pace')" sortable>
      <template #body="{ data }">{{ decimal((data as Row).checksPerHour) }}</template>
    </Column>
    <Column field="medianChecksPerHour" :header="t('pace.columns.median')" sortable>
      <template #body="{ data }">{{ decimal((data as Row).medianChecksPerHour) }}</template>
    </Column>
  </DataTable>
</template>

<style scoped>
.game-pace-table {
  font-size: 0.8125rem;
}

.game-pace-table :deep(th),
.game-pace-table :deep(td) {
  padding: 0.3rem 0.375rem;
}

.nowrap {
  white-space: nowrap;
}
</style>
