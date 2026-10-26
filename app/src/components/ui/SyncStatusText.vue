<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import DateTimeText from './DateTimeText.vue';

import type { SyncStatus } from '@/api/types';

const props = defineProps<{ status: SyncStatus }>();
const { t } = useI18n();
</script>

<template>
  <span class="sync-status">
    <span v-if="props.status.running"><i class="pi pi-spin pi-spinner" /> {{ t('room.syncRunning') }}</span>
    <span v-else>
      {{ t('room.lastSuccessfulSync') }}
      <DateTimeText :value="props.status.lastSuccessfulSyncAt" />
    </span>
    <span v-if="props.status.lastSyncError" class="inactivity-red" :title="props.status.lastSyncError">
      <i class="pi pi-exclamation-triangle" /> {{ t('room.syncError') }}
    </span>
  </span>
</template>

<style scoped>
.sync-status {
  display: inline-flex;
  gap: 0.75rem;
  align-items: center;
}
</style>
