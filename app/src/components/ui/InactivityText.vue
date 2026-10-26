<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { InactivityLevel } from '@/domain/inactivity';

const props = defineProps<{ hours: number | null; level: InactivityLevel }>();
const { t } = useI18n();

const text = computed(() => {
  if (props.hours === null) {
    return t('common.none');
  }
  const days = Math.floor(props.hours / 24);
  const hours = Math.floor(props.hours % 24);
  return days > 0 ? t('inactivity.daysHours', { days, hours }) : t('inactivity.hours', { hours });
});
</script>

<template>
  <span :class="{ 'inactivity-yellow': props.level === 'yellow', 'inactivity-red': props.level === 'red' }">
    {{ text }}
  </span>
</template>
