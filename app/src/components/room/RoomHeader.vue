<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';

import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';

import SyncStatusText from '@/components/ui/SyncStatusText.vue';

import { useCurrentRoomStore } from '@/stores/current-room';
import { useLiveStore } from '@/stores/live';

const roomStore = useCurrentRoomStore();
const { room, isAdmin, isHelper, isPlayer, canSeeLocations, syncRequested, slotsWithoutDiscord } =
  storeToRefs(roomStore);
const { isConnected } = storeToRefs(useLiveStore());
const { t } = useI18n();

const tabs = computed(() => [
  { name: 'roster', label: t('room.tabs.roster'), visible: true },
  { name: 'players', label: t('room.tabs.players'), visible: true },
  { name: 'statistics', label: t('room.tabs.statistics'), visible: true },
  { name: 'unlock-tree', label: t('room.tabs.unlockTree'), visible: true },
  { name: 'spheres', label: t('room.tabs.spheres'), visible: canSeeLocations.value },
  { name: 'locations-open', label: t('room.tabs.locations'), visible: canSeeLocations.value },
  { name: 'my-slots', label: t('room.tabs.mySlots'), visible: isPlayer.value },
  { name: 'admin', label: t('room.tabs.admin'), visible: isHelper.value },
]);
</script>

<template>
  <header v-if="room" class="room-header">
    <div class="app-toolbar">
      <h1 data-testid="room-title">{{ room.title }}</h1>
      <Tag
        :severity="isConnected ? 'success' : 'secondary'"
        :value="isConnected ? t('room.live') : t('room.offline')"
        data-testid="live-indicator"
      />
      <span class="app-spacer" />
      <SyncStatusText :status="room.syncStatus" />
      <Button
        v-if="isAdmin"
        :label="t('room.syncNow')"
        icon="pi pi-refresh"
        size="small"
        :loading="syncRequested || room.syncStatus.running"
        data-testid="sync-now"
        @click="roomStore.requestSync()"
      />
    </div>
    <div class="app-toolbar app-muted">
      <a :href="room.cheeseTrackerUrl" target="_blank" rel="noopener">{{ t('room.cheeseLink') }}</a>
      <a :href="room.archipelagoTrackerUrl" target="_blank" rel="noopener">{{ t('room.archipelagoLink') }}</a>
      <span>{{ t('room.limits', { yellow: room.yellowLimitHours, red: room.redLimitHours }) }}</span>
    </div>
    <Message v-if="isAdmin && room.unknownSlotNames.length > 0" severity="warn">
      {{ t('room.unknownSlotNames', { names: room.unknownSlotNames.join(', ') }) }}
    </Message>
    <Message
      v-if="isAdmin && slotsWithoutDiscord.length > 0"
      severity="info"
      closable
      data-testid="slots-without-discord"
    >
      {{
        t('room.slotsWithoutDiscord', {
          count: slotsWithoutDiscord.length,
          names: slotsWithoutDiscord.map((slot) => `#${slot.position} ${slot.name}`).join(', '),
        })
      }}
    </Message>
    <nav class="room-tabs">
      <template v-for="tab in tabs" :key="tab.name">
        <RouterLink v-if="tab.visible" :to="{ name: tab.name, params: { slug: room.slug } }" class="room-tab">
          {{ tab.label }}
        </RouterLink>
      </template>
    </nav>
  </header>
</template>

<style scoped>
.room-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.room-header h1 {
  margin: 0;
}

.room-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.room-tab {
  padding: 0.5rem 1rem;
  text-decoration: none;
  border-bottom: 2px solid transparent;
}

.room-tab.router-link-exact-active {
  border-bottom-color: var(--p-primary-color);
  font-weight: 600;
}
</style>
