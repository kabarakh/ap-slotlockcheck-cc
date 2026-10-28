<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import Message from 'primevue/message';

import LocationFilterBar from '@/components/locations/LocationFilterBar.vue';
import LocationListPanel from '@/components/locations/LocationListPanel.vue';

import type { LocationState } from '@/api/types';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useLocationsStore } from '@/stores/locations';
import { useServerAdminStore } from '@/stores/server-admin';

const { room, isHelper, isAdmin, slotById } = storeToRefs(useCurrentRoomStore());
const { locationState, view } = storeToRefs(useLocationsStore());
const { loggedIn, status } = storeToRefs(useServerAdminStore());
const { t } = useI18n();

const states: LocationState[] = ['open', 'found', 'filler'];
const routePrefix = computed(() => (view.value === 'admin' ? 'control-locations-' : 'locations-'));
const otherRoutePrefix = computed(() => (view.value === 'admin' ? 'locations-' : 'control-locations-'));
const connectedSlotName = computed(() => slotById.value.get(status.value?.slotId ?? -1)?.name ?? '');

onMounted(() => {
  if (isAdmin.value) {
    void useServerAdminStore().fetchStatus();
  }
});
</script>

<template>
  <section v-if="room" class="locations-view">
    <nav class="app-toolbar">
      <RouterLink
        v-for="state in states"
        :key="state"
        :to="{ name: `${routePrefix}${state}`, params: { slug: room.slug } }"
        class="location-tab"
        :class="{ active: locationState === state }"
        :data-testid="`location-tab-${state}`"
      >
        {{ t(`locations.states.${state}`) }}
      </RouterLink>
      <span class="app-spacer" />
      <RouterLink
        v-if="isHelper && locationState"
        :to="{ name: `${otherRoutePrefix}${locationState}`, params: { slug: room.slug } }"
        data-testid="location-view-switch"
      >
        {{ view === 'admin' ? t('locations.userView') : t('locations.adminView') }}
      </RouterLink>
    </nav>
    <Message v-if="view === 'admin'" severity="warn" :closable="false">{{ t('locations.adminViewHint') }}</Message>
    <p v-if="view === 'admin' && isAdmin" class="app-muted" data-testid="location-server-status">
      <template v-if="loggedIn">{{ t('server.loggedInAs', { slot: connectedSlotName }) }}</template>
      <template v-else>
        {{ t('control.serverNotLoggedIn') }}
        <RouterLink :to="{ name: 'control-server', params: { slug: room.slug } }">
          {{ t('control.tabs.server') }}
        </RouterLink>
      </template>
    </p>
    <LocationFilterBar />
    <LocationListPanel />
  </section>
</template>

<style scoped>
.locations-view {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.location-tab {
  padding: 0.25rem 0.75rem;
  text-decoration: none;
  border-bottom: 2px solid transparent;
}

.location-tab.active {
  border-bottom-color: var(--p-primary-color);
  font-weight: 600;
}
</style>
