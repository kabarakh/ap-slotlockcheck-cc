<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, RouterView, useRoute } from 'vue-router';

import StatisticsFilterBar from '@/components/statistics/StatisticsFilterBar.vue';

import { useCurrentRoomStore } from '@/stores/current-room';

const { room, hasSlotLock } = storeToRefs(useCurrentRoomStore());
const route = useRoute();
const { t } = useI18n();

const tabs = computed(() =>
  [
    { name: 'statistics', label: t('statistics.tabs.overview'), visible: true },
    { name: 'statistics-unlock-times', label: t('statistics.tabs.unlockTimes'), visible: hasSlotLock.value },
    { name: 'statistics-unlock-senders', label: t('statistics.tabs.unlockSenders'), visible: hasSlotLock.value },
    { name: 'statistics-progress', label: t('statistics.tabs.progress'), visible: true },
  ].filter((tab) => tab.visible),
);
</script>

<template>
  <section v-if="room" class="statistics-view">
    <nav class="statistics-tabs" data-testid="statistics-tabs">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name, params: { slug: room.slug } }"
        class="statistics-tab"
        :class="{ active: route.name === tab.name }"
        :data-testid="`statistics-tab-${tab.name}`"
      >
        {{ tab.label }}
      </RouterLink>
    </nav>
    <StatisticsFilterBar />
    <RouterView />
  </section>
</template>

<style scoped>
.statistics-view {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.statistics-tabs {
  display: flex;
  border-bottom: 1px solid var(--p-content-border-color);
  flex-wrap: wrap;
  gap: 0.25rem;
}

.statistics-tab {
  padding: 0.25rem 0.75rem;
  text-decoration: none;
  border-bottom: 2px solid transparent;
}

.statistics-tab.active {
  border-bottom-color: var(--p-primary-color);
  font-weight: 600;
}
</style>
