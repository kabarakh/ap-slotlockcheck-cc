<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable, { type DataTablePageEvent } from 'primevue/datatable';
import Drawer from 'primevue/drawer';

import ItemTypeTag from '@/components/ui/ItemTypeTag.vue';

import type { LocationAdminRow } from '@/api/types';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useLocationsStore } from '@/stores/locations';
import { SPHERE_LOCATIONS_PAGE_SIZE, useSphereLocationsStore } from '@/stores/sphere-locations';
import { useSphereCleanupStore } from '@/stores/sphere-cleanup';

const sphereLocations = useSphereLocationsStore();
const { sphere, rows, total, offset, loading } = storeToRefs(sphereLocations);
const { slug } = storeToRefs(useCurrentRoomStore());
const router = useRouter();
const { t } = useI18n();

const visible = computed({
  get: () => sphere.value !== null,
  set: (value: boolean) => {
    if (!value) {
      sphereLocations.close();
    }
  },
});

const onPage = (event: DataTablePageEvent) => sphereLocations.setPage(event.first);

const openCleanup = async () => {
  if (sphere.value === null) {
    return;
  }
  useSphereCleanupStore().presetSphere(sphere.value);
  sphereLocations.close();
  await router.push({ name: 'control-messages', params: { slug: slug.value ?? '' } });
};

const openLocations = async () => {
  if (sphere.value === null) {
    return;
  }
  useLocationsStore().showSphere(sphere.value);
  sphereLocations.close();
  await router.push({ name: 'control-locations-open', params: { slug: slug.value ?? '' } });
};
</script>

<template>
  <Drawer
    v-model:visible="visible"
    position="right"
    :header="t('control.sphereLocations.title', { sphere: sphere ?? 0, count: total })"
    class="sphere-locations-drawer"
    data-testid="sphere-locations"
  >
    <div class="app-toolbar">
      <Button
        :label="t('control.sphereLocations.cleanup')"
        icon="pi pi-megaphone"
        size="small"
        data-testid="sphere-cleanup"
        @click="openCleanup()"
      />
      <Button
        :label="t('control.sphereLocations.showAll')"
        icon="pi pi-list"
        size="small"
        severity="secondary"
        data-testid="sphere-show-locations"
        @click="openLocations()"
      />
    </div>
    <DataTable
      :value="rows"
      data-key="id"
      lazy
      :paginator="total > SPHERE_LOCATIONS_PAGE_SIZE"
      :first="offset"
      :rows="SPHERE_LOCATIONS_PAGE_SIZE"
      :total-records="total"
      :loading="loading"
      size="small"
      striped-rows
      data-testid="sphere-locations-table"
      @page="onPage"
    >
      <template #empty>{{ t('locations.empty') }}</template>
      <Column :header="t('locations.columns.finder')">
        <template #body="{ data }">
          {{ (data as LocationAdminRow).finderName }}
          <div class="app-muted">{{ (data as LocationAdminRow).discordName ?? t('common.none') }}</div>
        </template>
      </Column>
      <Column field="locationName" :header="t('locations.columns.location')" />
      <Column :header="t('locations.columns.item')">
        <template #body="{ data }">
          {{ (data as LocationAdminRow).itemName }}
          <div class="app-muted">{{ (data as LocationAdminRow).receiverName }}</div>
        </template>
      </Column>
      <Column :header="t('locations.columns.type')">
        <template #body="{ data }"><ItemTypeTag :item-type="(data as LocationAdminRow).itemType" /></template>
      </Column>
    </DataTable>
  </Drawer>
</template>

<style>
.sphere-locations-drawer.p-drawer {
  width: min(48rem, 100vw);
}
</style>

<style scoped>
.app-toolbar {
  margin-bottom: 0.75rem;
}
</style>
