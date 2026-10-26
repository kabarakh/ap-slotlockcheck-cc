<script setup lang="ts">
import { storeToRefs } from 'pinia';

import Divider from 'primevue/divider';

import InactivityReminderPanel from '@/components/admin/InactivityReminderPanel.vue';
import SphereCleanupPanel from '@/components/spheres/SphereCleanupPanel.vue';

import { useCurrentRoomStore } from '@/stores/current-room';

const { room } = storeToRefs(useCurrentRoomStore());
</script>

<template>
  <InactivityReminderPanel />
  <template v-if="room?.hasSeed">
    <Divider />
    <SphereCleanupPanel />
  </template>
</template>
