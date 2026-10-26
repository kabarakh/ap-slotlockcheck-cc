<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent, type DataTableSortEvent } from 'primevue/datatable';
import type { LocationAdminRow, LocationSortField, LocationUserRow } from '@/api/types';
import DateTimeText from '@/components/ui/DateTimeText.vue';
import ItemTypeTag from '@/components/ui/ItemTypeTag.vue';
import { formatGameName } from '@/domain/game-name';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useLocationsStore } from '@/stores/locations';
import { useServerAdminStore } from '@/stores/server-admin';

const locations = useLocationsStore();
const { rows, total, loading, offset, limit, sortField, sortOrder, isAdminView, locationState } =
  storeToRefs(locations);
const serverAdmin = useServerAdminStore();
const { loggedIn, jobRunning } = storeToRefs(serverAdmin);
const { isAdmin } = storeToRefs(useCurrentRoomStore());
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
    <Column v-if="isAdminView && locationState === 'filler'" :header="t('locations.columns.markedBy')">
      <template #body="{ data }">
        {{ (data as LocationAdminRow).fillerMarkedByName ?? t('common.none') }},
        <DateTimeText :value="(data as LocationAdminRow).fillerMarkedAt" />
      </template>
    </Column>
    <Column :header="t('locations.columns.filler')">
      <template #body="{ data }">
        <Button
          v-if="(data as LocationUserRow).canMarkFiller && !(data as LocationUserRow).fillerMarked"
          :label="t('locations.markFiller')"
          icon="pi pi-flag"
          size="small"
          text
          data-testid="mark-filler"
          @click="locations.setFillerMark((data as LocationUserRow).id, true)"
        />
        <Button
          v-else-if="locations.canUnmarkFiller(data as LocationUserRow)"
          :label="t('locations.unmarkFiller')"
          icon="pi pi-flag-fill"
          size="small"
          severity="secondary"
          text
          data-testid="unmark-filler"
          @click="locations.setFillerMark((data as LocationUserRow).id, false)"
        />
        <i
          v-else-if="(data as LocationUserRow).fillerMarked"
          class="pi pi-flag-fill"
          :aria-label="t('locations.isMarked')"
        />
      </template>
    </Column>
    <Column
      v-if="isAdminView && isAdmin && loggedIn && locationState !== 'found'"
      :header="t('locations.columns.server')"
    >
      <template #body="{ data }">
        <Button
          :label="t('locations.sendLocation')"
          icon="pi pi-send"
          size="small"
          text
          :disabled="jobRunning"
          data-testid="send-location"
          @click="serverAdmin.sendLocation((data as LocationAdminRow).id)"
        />
      </template>
    </Column>
  </DataTable>
</template>
