<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { SlotLock } from '@/api/types';

const props = defineProps<{ locks: SlotLock[] }>();
const { t, d } = useI18n();

const entries = computed(() =>
  props.locks.map((lock) => ({
    key: lock.lockerSlotId,
    sender: lock.unlocked ? (lock.senderName ?? t('common.unknown')) : t('lockStatus.locked'),
    locker: props.locks.length > 1 ? lock.lockerName : null,
    unlocked: lock.unlocked,
    time: lock.unlocked && lock.unlockTime ? d(new Date(lock.unlockTime), 'dateTime') : null,
    source: lock.unlocked ? lock.timeSource : null,
  })),
);
</script>

<template>
  <ul class="unlock-info">
    <li v-for="entry in entries" :key="entry.key" :class="{ 'app-muted': !entry.unlocked }">
      <span>{{ entry.sender }}</span>
      <span v-if="entry.locker" class="app-muted"> ({{ entry.locker }})</span>
      <span v-if="entry.source" v-tooltip.top="t(`unlockTimeSource.${entry.source}`)" class="unlock-time app-muted">
        {{ entry.time ?? t('unlockTimeSource.unknown') }}
        <i v-if="entry.source === 'estimated'" class="pi pi-question-circle" />
        <i v-if="entry.source === 'manual' || entry.source === 'csv'" class="pi pi-pencil" />
      </span>
    </li>
  </ul>
</template>

<style scoped>
.unlock-info {
  margin: 0;
  padding: 0;
  list-style: none;
}

.unlock-info li + li {
  margin-top: 0.25rem;
}

.unlock-time {
  display: block;
  font-size: 0.75rem;
  white-space: nowrap;
}
</style>
