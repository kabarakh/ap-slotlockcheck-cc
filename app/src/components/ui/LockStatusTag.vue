<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Tag from 'primevue/tag';

import type { LockStatus } from '@/api/types';

const props = defineProps<{ status: LockStatus }>();
const { t } = useI18n();

const severity = computed(
  () =>
    ({
      not_locked: 'secondary',
      start_slot: 'info',
      locked: 'danger',
      partially_unlocked: 'warn',
      unlocked: 'success',
    })[props.status],
);
</script>

<template>
  <Tag :severity="severity" :value="t(`lockStatus.${props.status}`)" />
</template>
