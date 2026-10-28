<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, RouterView, useRoute } from 'vue-router';

import Badge from 'primevue/badge';

import { useCurrentRoomStore } from '@/stores/current-room';
import { useInactivityReminderStore } from '@/stores/inactivity-reminder';
import { useServerAdminStore } from '@/stores/server-admin';
import { useSphereOverviewStore } from '@/stores/sphere-overview';
import { useWarningsStore } from '@/stores/warnings';

interface ControlTab {
  name: string;
  label: string;
  section: string;
  visible: boolean;
  badges: { value: number | string; severity: 'danger' | 'warn' | 'info' | 'secondary'; testId: string }[];
}

const { room, isAdmin, canSeeLocations } = storeToRefs(useCurrentRoomStore());
const { overview } = storeToRefs(useSphereOverviewStore());
const { levelCounts } = storeToRefs(useInactivityReminderStore());
const { warnings } = storeToRefs(useWarningsStore());
const route = useRoute();
const { t } = useI18n();

const tabs = computed<ControlTab[]>(() => [
  {
    name: 'control-spheres',
    label: t('control.tabs.spheres'),
    section: 'spheres',
    visible: canSeeLocations.value,
    badges:
      overview.value?.lowestOpenSphere === null || overview.value === null
        ? []
        : [{ value: overview.value.lowestOpenSphere, severity: 'info', testId: 'control-badge-sphere' }],
  },
  {
    name: 'control-locations-open',
    label: t('control.tabs.locations'),
    section: 'locations',
    visible: canSeeLocations.value,
    badges: [],
  },
  {
    name: 'control-messages',
    label: t('control.tabs.messages'),
    section: 'messages',
    visible: true,
    badges: [
      ...(levelCounts.value.red > 0
        ? [{ value: levelCounts.value.red, severity: 'danger' as const, testId: 'control-badge-red' }]
        : []),
      ...(levelCounts.value.yellow > 0
        ? [{ value: levelCounts.value.yellow, severity: 'warn' as const, testId: 'control-badge-yellow' }]
        : []),
    ],
  },
  {
    name: 'control-warnings',
    label: t('control.tabs.warnings'),
    section: 'warnings',
    visible: isAdmin.value,
    badges:
      warnings.value.length > 0
        ? [{ value: warnings.value.length, severity: 'secondary', testId: 'control-badge-warnings' }]
        : [],
  },
  {
    name: 'control-server',
    label: t('control.tabs.server'),
    section: 'server',
    visible: isAdmin.value && canSeeLocations.value,
    badges: [],
  },
]);

const activeSection = computed(() => String(route.name ?? '').split('-')[1] ?? '');

onMounted(() => {
  if (canSeeLocations.value) {
    void useSphereOverviewStore().fetch();
  }
  if (isAdmin.value && canSeeLocations.value) {
    void useServerAdminStore().fetchStatus();
  }
});
</script>

<template>
  <section v-if="room" class="control">
    <nav class="control-tabs" data-testid="control-tabs">
      <template v-for="tab in tabs" :key="tab.name">
        <RouterLink
          v-if="tab.visible"
          :to="{ name: tab.name, params: { slug: room.slug } }"
          class="control-tab"
          :class="{ active: activeSection === tab.section }"
          :data-testid="`control-tab-${tab.section}`"
        >
          {{ tab.label }}
          <Badge
            v-for="badge in tab.badges"
            :key="badge.testId"
            :value="badge.value"
            :severity="badge.severity"
            size="small"
            :data-testid="badge.testId"
          />
        </RouterLink>
      </template>
    </nav>
    <RouterView />
  </section>
</template>

<style scoped>
.control {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.control-tabs {
  display: flex;
  border-bottom: 1px solid var(--p-content-border-color);
  flex-wrap: wrap;
  gap: 0.25rem;
}

.control-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  text-decoration: none;
  border-bottom: 2px solid transparent;
}

.control-tab.active {
  border-bottom-color: var(--p-primary-color);
  font-weight: 600;
}
</style>
