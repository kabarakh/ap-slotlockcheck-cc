<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Tab from 'primevue/tab';
import TabList from 'primevue/tablist';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import Tabs from 'primevue/tabs';
import AdminListPanel from '@/components/admin/AdminListPanel.vue';
import AdminSettingsPanel from '@/components/admin/AdminSettingsPanel.vue';
import InvitationPanel from '@/components/admin/InvitationPanel.vue';
import LockAssignmentPanel from '@/components/admin/LockAssignmentPanel.vue';
import SeedPanel from '@/components/admin/SeedPanel.vue';
import UnlockTimesPanel from '@/components/admin/UnlockTimesPanel.vue';
import WarningsPanel from '@/components/admin/WarningsPanel.vue';
import { useAdminStore } from '@/stores/admin';

const admin = useAdminStore();
const { t } = useI18n();

onMounted(() => admin.load());
</script>

<template>
  <Tabs value="settings" lazy>
    <TabList>
      <Tab value="settings">{{ t('admin.tabs.settings') }}</Tab>
      <Tab value="locks">{{ t('admin.tabs.locks') }}</Tab>
      <Tab value="admins">{{ t('admin.tabs.admins') }}</Tab>
      <Tab value="warnings" data-testid="tab-warnings">{{ t('admin.tabs.warnings') }}</Tab>
      <Tab value="unlockTimes" data-testid="tab-unlock-times">{{ t('admin.tabs.unlockTimes') }}</Tab>
      <Tab value="seed" data-testid="tab-seed">{{ t('admin.tabs.seed') }}</Tab>
    </TabList>
    <TabPanels>
      <TabPanel value="settings"><AdminSettingsPanel /></TabPanel>
      <TabPanel value="locks"><LockAssignmentPanel /></TabPanel>
      <TabPanel value="admins">
        <AdminListPanel />
        <InvitationPanel />
      </TabPanel>
      <TabPanel value="warnings"><WarningsPanel /></TabPanel>
      <TabPanel value="unlockTimes"><UnlockTimesPanel /></TabPanel>
      <TabPanel value="seed"><SeedPanel /></TabPanel>
    </TabPanels>
  </Tabs>
</template>
