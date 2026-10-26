<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import Message from 'primevue/message';
import type { LocationState } from '@/api/types';
import LocationFilterBar from '@/components/locations/LocationFilterBar.vue';
import LocationListPanel from '@/components/locations/LocationListPanel.vue';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useLocationsStore } from '@/stores/locations';
import { useServerAdminStore } from '@/stores/server-admin';

const { room, isHelper, isAdmin } = storeToRefs(useCurrentRoomStore());
const { locationState, view } = storeToRefs(useLocationsStore());
const { t } = useI18n();

const states: LocationState[] = ['open', 'found', 'filler'];
const query = computed(() => (view.value === 'admin' ? { view: 'admin' } : {}));

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
        :to="{ name: `locations-${state}`, params: { slug: room.slug }, query }"
        class="location-tab"
        :class="{ active: locationState === state }"
        :data-testid="`location-tab-${state}`"
      >
        {{ t(`locations.states.${state}`) }}
      </RouterLink>
      <span class="app-spacer" />
      <RouterLink
        v-if="isHelper && locationState"
        :to="{
          name: `locations-${locationState}`,
          params: { slug: room.slug },
          query: view === 'admin' ? {} : { view: 'admin' },
        }"
        data-testid="location-view-switch"
      >
        {{ view === 'admin' ? t('locations.userView') : t('locations.adminView') }}
      </RouterLink>
    </nav>
    <Message v-if="view === 'admin'" severity="warn" :closable="false">{{ t('locations.adminViewHint') }}</Message>
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
