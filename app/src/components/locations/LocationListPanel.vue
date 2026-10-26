<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent, type DataTableSortEvent } from 'primevue/datatable';
import type { LocationAdminRow, LocationSortField } from '@/api/types';
import ItemTypeTag from '@/components/ui/ItemTypeTag.vue';
import { formatGameName } from '@/domain/game-name';
import { useLocationsStore } from '@/stores/locations';

const locations = useLocationsStore();
const { rows, total, loading, offset, limit, sortField, sortOrder, isAdminView } = storeToRefs(locations);
const { t } = useI18n();

const onPage = (event: DataTablePageEvent) => locations.setPage(event.first, event.rows);
const onSort = (event: DataTableSortEvent) =>
  locations.setSort(
    (event.sortField as LocationSortField | undefined) ?? 'sphere',
    event.sortOrder === -1 ? 'desc' : 'asc',
  );
</script>

<template>
  <DataTable
    :value="rows"
    data-key="id"
    lazy
    paginator
    :first="offset"
    :rows="limit"
    :rows-per-page-options="[25, 50, 100, 200]"
    :total-records="total"
    :loading="loading"
    :sort-field="sortField"
    :sort-order="sortOrder === 'desc' ? -1 : 1"
    size="small"
    striped-rows
    data-testid="location-table"
    @page="onPage"
    @sort="onSort"
  >
    <template #empty>{{ t('locations.empty') }}</template>
    <Column field="sphere" :header="t('locations.columns.sphere')" sortable />
    <Column field="finder" :header="t('locations.columns.finder')" sortable>
      <template #body="{ data }">{{ data.finderName }}</template>
    </Column>
    <Column :header="t('locations.columns.discord')">
      <template #body="{ data }">{{ data.discordName ?? t('common.none') }}</template>
    </Column>
    <Column v-if="isAdminView" field="receiver" :header="t('locations.columns.receiver')" sortable>
      <template #body="{ data }">{{ (data as LocationAdminRow).receiverName }}</template>
    </Column>
    <Column v-if="isAdminView" field="item" :header="t('locations.columns.item')" sortable>
      <template #body="{ data }">{{ (data as LocationAdminRow).itemName }}</template>
    </Column>
    <Column field="game" :header="t('locations.columns.game')" sortable>
      <template #body="{ data }">{{ formatGameName(data.game) }}</template>
    </Column>
    <Column v-if="isAdminView" :header="t('locations.columns.type')">
      <template #body="{ data }"><ItemTypeTag :item-type="(data as LocationAdminRow).itemType" /></template>
    </Column>
    <Column field="location" :header="t('locations.columns.location')" sortable>
      <template #body="{ data }">{{ data.locationName }}</template>
    </Column>
  </DataTable>
</template>
