<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import Checkbox from 'primevue/checkbox';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import InputText from 'primevue/inputtext';
import ProgressBar from 'primevue/progressbar';
import Tag from 'primevue/tag';

import DateTimeText from '@/components/ui/DateTimeText.vue';
import SyncStatusText from '@/components/ui/SyncStatusText.vue';

import type { RoomListEntry } from '@/api/types';
import { checksPercentage } from '@/domain/summary';
import { useAuthStore } from '@/stores/auth';
import { useRoomsStore } from '@/stores/rooms';
import { useTableFiltersStore } from '@/stores/table-filters';

type RoomRoleKey = 'owner' | 'admin' | 'helper' | 'player';

const roomsStore = useRoomsStore();
const { sortedRooms, loading } = storeToRefs(roomsStore);
const { roomText, showArchivedRooms } = storeToRefs(useTableFiltersStore());
const { isLoggedIn } = storeToRefs(useAuthStore());
const { t } = useI18n();

const visibleRooms = computed(() => {
  const needle = roomText.value.trim().toLocaleLowerCase();
  return sortedRooms.value.filter(
    (room) => (showArchivedRooms.value || room.archivedAt === null) && room.title.toLocaleLowerCase().includes(needle),
  );
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
      <label class="app-toolbar">
        <Checkbox v-model="showArchivedRooms" binary data-testid="show-archived-rooms" />
        {{ t('rooms.showArchived') }}
      </label>
      <InputText v-model="roomText" :placeholder="t('filters.search')" size="small" />
    </div>
    <p class="app-muted" data-testid="rooms-hint">
      {{ isLoggedIn ? t('rooms.onlyOwnRooms') : t('rooms.loginForRooms') }}
    </p>
    <DataTable :value="visibleRooms" :loading="loading" data-key="id" striped-rows>
      <template #empty>{{ isLoggedIn ? t('rooms.empty') : t('rooms.emptyVisitor') }}</template>
      <Column field="title" :header="t('rooms.columns.title')" sortable>
        <template #body="{ data }">
          <RouterLink :to="{ name: 'roster', params: { slug: (data as RoomListEntry).slug } }">
            {{ (data as RoomListEntry).title }}
          </RouterLink>
          <Tag
            v-if="(data as RoomListEntry).archivedAt"
            :value="t('rooms.archived')"
            severity="secondary"
            class="archived-tag"
            data-testid="room-archived"
          />
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
          <div class="progress-lines">
            <template v-if="(data as RoomListEntry).hasSlotLock">
              <span>{{ t('rooms.unlocks') }}</span>
              <div class="progress-bar" data-testid="room-unlocks">
                <ProgressBar
                  :value="(data as RoomListEntry).unlockedPercentage"
                  :show-value="false"
                  class="room-list-bar"
                />
                <span class="room-list-bar-text">
                  {{
                    t('rooms.progressValue', {
                      done: (data as RoomListEntry).unlockedSlotCount,
                      total: (data as RoomListEntry).lockedSlotCount,
                      percentage: (data as RoomListEntry).unlockedPercentage,
                    })
                  }}
                </span>
              </div>
            </template>
            <span>{{ t('rooms.checks') }}</span>
            <div class="progress-bar" data-testid="room-checks">
              <ProgressBar
                :value="checksPercentage((data as RoomListEntry).checksDone, (data as RoomListEntry).checksTotal)"
                :show-value="false"
                class="room-list-bar room-list-bar-checks"
              />
              <span class="room-list-bar-text">
                {{
                  t('rooms.progressValue', {
                    done: (data as RoomListEntry).checksDone,
                    total: (data as RoomListEntry).checksTotal,
                    percentage: checksPercentage(
                      (data as RoomListEntry).checksDone,
                      (data as RoomListEntry).checksTotal,
                    ),
                  })
                }}
              </span>
            </div>
          </div>
        </template>
      </Column>
      <Column :header="t('rooms.columns.status')">
        <template #body="{ data }">
          <span v-if="(data as RoomListEntry).archivedAt">
            {{ t('rooms.archivedAt') }} <DateTimeText :value="(data as RoomListEntry).archivedAt" />
          </span>
          <SyncStatusText v-else :status="(data as RoomListEntry).syncStatus" />
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<style scoped>
.archived-tag {
  margin-left: 0.5rem;
}

.progress-lines {
  display: grid;
  grid-template-columns: max-content minmax(12rem, 1fr);
  gap: 0.25rem 0.5rem;
  align-items: center;
}

.progress-bar {
  position: relative;
}

.room-list-bar {
  height: 1.25rem;
  background: var(--p-surface-300);
}

.room-list-bar :deep(.p-progressbar-value) {
  background: var(--p-sky-600);
}

.room-list-bar-checks :deep(.p-progressbar-value) {
  background: var(--p-emerald-600);
}

.room-list-bar-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--p-surface-900);
  text-shadow:
    1px 0 0 var(--p-surface-0),
    -1px 0 0 var(--p-surface-0),
    0 1px 0 var(--p-surface-0),
    0 -1px 0 var(--p-surface-0),
    1px 1px 0 var(--p-surface-0),
    -1px -1px 0 var(--p-surface-0),
    1px -1px 0 var(--p-surface-0),
    -1px 1px 0 var(--p-surface-0);
  pointer-events: none;
}
</style>
