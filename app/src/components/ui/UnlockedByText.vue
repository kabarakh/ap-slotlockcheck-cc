<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SlotLock } from '@/api/types';

const props = defineProps<{ locks: SlotLock[] }>();
const { t } = useI18n();

const entries = computed(() =>
  props.locks.map((lock) => ({
    key: lock.lockerSlotId,
    text: lock.unlocked ? (lock.senderName ?? t('common.unknown')) : t('lockStatus.locked'),
    locker: lock.lockerName,
    unlocked: lock.unlocked,
  })),
);
</script>

<template>
  <ul class="unlocked-by">
    <li v-for="entry in entries" :key="entry.key" :class="{ 'app-muted': !entry.unlocked }">
      {{ entry.text }}
      <span v-if="entries.length > 1" class="app-muted">({{ entry.locker }})</span>
    </li>
  </ul>
</template>

<style scoped>
.unlocked-by {
  margin: 0;
  padding: 0;
  list-style: none;
}
</style>
