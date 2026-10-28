<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';

import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';

import DateTimeText from '@/components/ui/DateTimeText.vue';
import SyncStatusText from '@/components/ui/SyncStatusText.vue';

import { useCurrentRoomStore } from '@/stores/current-room';
import { useLiveStore } from '@/stores/live';

const roomStore = useCurrentRoomStore();
const {
  room,
  isAdmin,
  isHelper,
  isPlayer,
  isArchived,
  canSeeLocations,
  hasSlotLock,
  syncRequested,
  slotsWithoutDiscord,
} = storeToRefs(roomStore);
const { isConnected } = storeToRefs(useLiveStore());
const { t } = useI18n();

const route = useRoute();

const tabs = computed(() => [
  { name: 'roster', section: '', label: t('room.tabs.roster'), visible: true },
  { name: 'players', section: 'players', label: t('room.tabs.players'), visible: true },
  { name: 'statistics', section: 'statistics', label: t('room.tabs.statistics'), visible: true },
  { name: 'unlock-tree', section: 'unlock-tree', label: t('room.tabs.unlockTree'), visible: hasSlotLock.value },
  { name: 'spheres', section: 'spheres', label: t('room.tabs.spheres'), visible: canSeeLocations.value },
  { name: 'locations-open', section: 'locations', label: t('room.tabs.locations'), visible: canSeeLocations.value },
  { name: 'my-slots', section: 'my-slots', label: t('room.tabs.mySlots'), visible: isPlayer.value },
  { name: 'control', section: 'control', label: t('room.tabs.control'), visible: isHelper.value },
  { name: 'admin', section: 'admin', label: t('room.tabs.admin'), visible: isHelper.value },
]);

const activeSection = computed(() => route.path.split('/')[3] ?? '');
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
      <Tag v-if="isArchived" severity="secondary" icon="pi pi-box" data-testid="archived-tag">
        {{ t('room.archived') }}&nbsp;<DateTimeText :value="room.archivedAt" />
      </Tag>
      <span class="app-spacer" />
      <SyncStatusText v-if="!isArchived" :status="room.syncStatus" />
      <Button
        v-if="isAdmin && !isArchived"
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
        <RouterLink
          v-if="tab.visible"
          :to="{ name: tab.name, params: { slug: room.slug } }"
          class="room-tab"
          :class="{ active: activeSection === tab.section }"
          :data-testid="`room-tab-${tab.name}`"
        >
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

.room-tab.active {
  border-bottom-color: var(--p-primary-color);
  font-weight: 600;
}
</style>
