<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';

import AdminListPanel from '@/components/admin/AdminListPanel.vue';
import AdminSettingsPanel from '@/components/admin/AdminSettingsPanel.vue';
import InactivityReminderPanel from '@/components/admin/InactivityReminderPanel.vue';
import InvitationPanel from '@/components/admin/InvitationPanel.vue';
import LockAssignmentPanel from '@/components/admin/LockAssignmentPanel.vue';
import RoomOwnershipPanel from '@/components/admin/RoomOwnershipPanel.vue';
import SeedPanel from '@/components/admin/SeedPanel.vue';
import ServerCommandsPanel from '@/components/admin/ServerCommandsPanel.vue';
import ServerConnectionPanel from '@/components/admin/ServerConnectionPanel.vue';
import ServerJobProgress from '@/components/admin/ServerJobProgress.vue';
import SphereCheckerSettingsPanel from '@/components/admin/SphereCheckerSettingsPanel.vue';
import UnlockTimesPanel from '@/components/admin/UnlockTimesPanel.vue';
import WarningsPanel from '@/components/admin/WarningsPanel.vue';
import SphereCleanupPanel from '@/components/spheres/SphereCleanupPanel.vue';

import { useAdminStore } from '@/stores/admin';
import { useCurrentRoomStore } from '@/stores/current-room';

const admin = useAdminStore();
const { isAdmin, room } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

onMounted(() => {
  if (isAdmin.value) {
    void admin.load();
  }
});
</script>

<template>
  <Tabs :value="isAdmin ? 'settings' : room?.hasSeed ? 'cleanup' : 'room'" lazy>
    <TabList>
      <template v-if="isAdmin">
        <Tab value="settings">{{ t('admin.tabs.settings') }}</Tab>
        <Tab value="locks">{{ t('admin.tabs.locks') }}</Tab>
        <Tab value="admins">{{ t('admin.tabs.admins') }}</Tab>
        <Tab value="warnings" data-testid="tab-warnings">{{ t('admin.tabs.warnings') }}</Tab>
        <Tab value="unlockTimes" data-testid="tab-unlock-times">{{ t('admin.tabs.unlockTimes') }}</Tab>
        <Tab value="seed" data-testid="tab-seed">{{ t('admin.tabs.seed') }}</Tab>
        <Tab v-if="room?.hasSeed" value="server" data-testid="tab-server">{{ t('admin.tabs.server') }}</Tab>
      </template>
      <Tab value="reminder" data-testid="tab-reminder">{{ t('admin.tabs.reminder') }}</Tab>
      <Tab v-if="room?.hasSeed" value="cleanup" data-testid="tab-cleanup">{{ t('admin.tabs.cleanup') }}</Tab>
      <Tab value="room" data-testid="tab-room">{{ t('admin.tabs.room') }}</Tab>
    </TabList>
    <TabPanels>
      <template v-if="isAdmin">
        <TabPanel value="settings"><AdminSettingsPanel /></TabPanel>
        <TabPanel value="locks"><LockAssignmentPanel /></TabPanel>
        <TabPanel value="admins">
          <AdminListPanel />
          <InvitationPanel />
        </TabPanel>
        <TabPanel value="warnings"><WarningsPanel /></TabPanel>
        <TabPanel value="unlockTimes"><UnlockTimesPanel /></TabPanel>
        <TabPanel value="seed">
          <SeedPanel />
          <SphereCheckerSettingsPanel />
        </TabPanel>
        <TabPanel v-if="room?.hasSeed" value="server">
          <ServerConnectionPanel />
          <ServerJobProgress />
          <ServerCommandsPanel />
        </TabPanel>
      </template>
      <TabPanel value="reminder"><InactivityReminderPanel /></TabPanel>
      <TabPanel v-if="room?.hasSeed" value="cleanup"><SphereCleanupPanel /></TabPanel>
      <TabPanel value="room"><RoomOwnershipPanel /></TabPanel>
    </TabPanels>
  </Tabs>
</template>
