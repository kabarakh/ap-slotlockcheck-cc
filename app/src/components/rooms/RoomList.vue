<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import type { RoomSummary } from '@/api/types';
import SyncStatusText from '@/components/ui/SyncStatusText.vue';
import { useRoomsStore } from '@/stores/rooms';
import { useTableFiltersStore } from '@/stores/table-filters';

const roomsStore = useRoomsStore();
const { sortedRooms, loading } = storeToRefs(roomsStore);
const { roomText } = storeToRefs(useTableFiltersStore());
const { t } = useI18n();

const visibleRooms = computed(() => {
  const needle = roomText.value.trim().toLocaleLowerCase();
  return sortedRooms.value.filter((room) => room.title.toLocaleLowerCase().includes(needle));
});

onMounted(() => roomsStore.fetchRooms());
</script>

<template>
  <section>
    <div class="app-toolbar">
      <h1>{{ t('rooms.title') }}</h1>
      <span class="app-spacer" />
      <InputText v-model="roomText" :placeholder="t('filters.search')" size="small" />
    </div>
    <DataTable :value="visibleRooms" :loading="loading" data-key="id" sort-field="title" :sort-order="1" striped-rows>
      <template #empty>{{ t('rooms.empty') }}</template>
      <Column field="title" :header="t('rooms.columns.title')" sortable>
        <template #body="{ data }">
          <RouterLink :to="{ name: 'roster', params: { slug: (data as RoomSummary).slug } }">
            {{ (data as RoomSummary).title }}
          </RouterLink>
        </template>
      </Column>
      <Column field="slotCount" :header="t('rooms.columns.slots')" sortable />
      <Column field="unlockedPercentage" :header="t('rooms.columns.progress')" sortable>
        <template #body="{ data }">
          <ProgressBar :value="(data as RoomSummary).unlockedPercentage" :show-value="true" class="room-progress" />
          <span class="app-muted">
            {{
              t('rooms.unlockedOf', {
                unlocked: (data as RoomSummary).unlockedSlotCount,
                locked: (data as RoomSummary).lockedSlotCount,
              })
            }}
          </span>
        </template>
      </Column>
      <Column :header="t('rooms.columns.status')">
        <template #body="{ data }">
          <SyncStatusText :status="(data as RoomSummary).syncStatus" />
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<style scoped>
.room-progress {
  min-width: 8rem;
  height: 1.25rem;
}
</style>
