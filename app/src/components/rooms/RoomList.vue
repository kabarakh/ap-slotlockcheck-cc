<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';
import type { RoomListEntry } from '@/api/types';
import SyncStatusText from '@/components/ui/SyncStatusText.vue';
import { useAuthStore } from '@/stores/auth';
import { useRoomsStore } from '@/stores/rooms';
import { useTableFiltersStore } from '@/stores/table-filters';

type RoomRoleKey = 'owner' | 'admin' | 'helper' | 'player';

const roomsStore = useRoomsStore();
const { sortedRooms, loading } = storeToRefs(roomsStore);
const { roomText } = storeToRefs(useTableFiltersStore());
const { isLoggedIn } = storeToRefs(useAuthStore());
const { t } = useI18n();

const visibleRooms = computed(() => {
  const needle = roomText.value.trim().toLocaleLowerCase();
  return sortedRooms.value.filter((room) => room.title.toLocaleLowerCase().includes(needle));
});

const roleKey = (room: RoomListEntry): RoomRoleKey =>
  room.membership.isOwner ? 'owner' : room.membership.role === 'visitor' ? 'player' : room.membership.role;

const roleSeverity: Record<RoomRoleKey, 'success' | 'info' | 'warn' | 'secondary'> = {
  owner: 'success',
  admin: 'info',
  helper: 'warn',
  player: 'secondary',
};

onMounted(() => roomsStore.fetchRooms());
watch(isLoggedIn, () => roomsStore.fetchRooms());
</script>

<template>
  <section>
    <div class="app-toolbar">
      <h1>{{ t('rooms.title') }}</h1>
      <span class="app-spacer" />
      <InputText v-model="roomText" :placeholder="t('filters.search')" size="small" />
    </div>
    <p class="app-muted" data-testid="rooms-hint">
      {{ isLoggedIn ? t('rooms.onlyOwnRooms') : t('rooms.loginForRooms') }}
    </p>
    <DataTable :value="visibleRooms" :loading="loading" data-key="id" sort-field="title" :sort-order="1" striped-rows>
      <template #empty>{{ isLoggedIn ? t('rooms.empty') : t('rooms.emptyVisitor') }}</template>
      <Column field="title" :header="t('rooms.columns.title')" sortable>
        <template #body="{ data }">
          <RouterLink :to="{ name: 'roster', params: { slug: (data as RoomListEntry).slug } }">
            {{ (data as RoomListEntry).title }}
          </RouterLink>
        </template>
      </Column>
      <Column field="membership.role" :header="t('rooms.columns.role')" sortable>
        <template #body="{ data }">
          <Tag
            :value="t(`rooms.roles.${roleKey(data as RoomListEntry)}`)"
            :severity="roleSeverity[roleKey(data as RoomListEntry)]"
            data-testid="room-role"
          />
        </template>
      </Column>
      <Column field="slotCount" :header="t('rooms.columns.slots')" sortable />
      <Column field="unlockedPercentage" :header="t('rooms.columns.progress')" sortable>
        <template #body="{ data }">
          <ProgressBar :value="(data as RoomListEntry).unlockedPercentage" :show-value="true" class="room-progress" />
          <span class="app-muted">
            {{
              t('rooms.unlockedOf', {
                unlocked: (data as RoomListEntry).unlockedSlotCount,
                locked: (data as RoomListEntry).lockedSlotCount,
              })
            }}
          </span>
        </template>
      </Column>
      <Column :header="t('rooms.columns.status')">
        <template #body="{ data }">
          <SyncStatusText :status="(data as RoomListEntry).syncStatus" />
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
