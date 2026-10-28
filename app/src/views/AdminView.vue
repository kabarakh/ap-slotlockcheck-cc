<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';

import AdminListPanel from '@/components/admin/AdminListPanel.vue';
import AdminSettingsPanel from '@/components/admin/AdminSettingsPanel.vue';
import InvitationPanel from '@/components/admin/InvitationPanel.vue';
import LockAssignmentPanel from '@/components/admin/LockAssignmentPanel.vue';
import PaceSettingsPanel from '@/components/admin/PaceSettingsPanel.vue';
import RoomArchivePanel from '@/components/admin/RoomArchivePanel.vue';
import RoomOwnershipPanel from '@/components/admin/RoomOwnershipPanel.vue';
import SeedPanel from '@/components/admin/SeedPanel.vue';
import SphereCheckerSettingsPanel from '@/components/admin/SphereCheckerSettingsPanel.vue';
import UnlockTimesPanel from '@/components/admin/UnlockTimesPanel.vue';

import { useAdminStore } from '@/stores/admin';
import { useCurrentRoomStore } from '@/stores/current-room';

const ADMIN_TABS = ['settings', 'locks', 'admins', 'seed', 'unlockTimes', 'room'] as const;
const LOCK_TABS: readonly string[] = ['locks', 'unlockTimes'];

const admin = useAdminStore();
const { isAdmin, hasSlotLock, slug } = storeToRefs(useCurrentRoomStore());
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const availableTabs = computed<readonly string[]>(() => {
  if (!isAdmin.value) {
    return ['room'];
  }
  return hasSlotLock.value ? ADMIN_TABS : ADMIN_TABS.filter((tab) => !LOCK_TABS.includes(tab));
});

const activeTab = computed({
  get: () => {
    const requested = String(route.params['tab'] ?? '');
    return availableTabs.value.includes(requested) ? requested : (availableTabs.value[0] ?? 'room');
  },
  set: (tab: string | number) => {
    void router.push({ name: 'admin', params: { slug: slug.value ?? '', tab: String(tab) } });
  },
});

onMounted(() => {
  if (isAdmin.value) {
    void admin.load();
  }
});
</script>

<template>
  <Tabs v-model:value="activeTab" lazy>
    <TabList>
      <template v-if="isAdmin">
        <Tab value="settings" data-testid="tab-settings">{{ t('admin.tabs.settings') }}</Tab>
        <Tab v-if="hasSlotLock" value="locks">{{ t('admin.tabs.locks') }}</Tab>
        <Tab value="admins">{{ t('admin.tabs.admins') }}</Tab>
        <Tab value="seed" data-testid="tab-seed">{{ t('admin.tabs.seed') }}</Tab>
        <Tab v-if="hasSlotLock" value="unlockTimes" data-testid="tab-unlock-times">{{
          t('admin.tabs.unlockTimes')
        }}</Tab>
      </template>
      <Tab value="room" data-testid="tab-room">{{ t('admin.tabs.room') }}</Tab>
    </TabList>
    <TabPanels>
      <template v-if="isAdmin">
        <TabPanel value="settings">
          <AdminSettingsPanel />
          <PaceSettingsPanel />
        </TabPanel>
        <TabPanel v-if="hasSlotLock" value="locks"><LockAssignmentPanel /></TabPanel>
        <TabPanel value="admins">
          <AdminListPanel />
          <InvitationPanel />
        </TabPanel>
        <TabPanel value="seed">
          <SeedPanel />
          <SphereCheckerSettingsPanel />
        </TabPanel>
        <TabPanel v-if="hasSlotLock" value="unlockTimes"><UnlockTimesPanel /></TabPanel>
      </template>
      <TabPanel value="room">
        <div class="room-panels">
          <RoomArchivePanel v-if="isAdmin" />
          <RoomOwnershipPanel />
        </div>
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>

<style scoped>
.room-panels {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
</style>
