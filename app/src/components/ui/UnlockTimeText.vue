<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import DateTimeText from './DateTimeText.vue';

import type { UnlockTimeSource } from '@/api/types';

const props = defineProps<{ time: string | null; source: UnlockTimeSource | null }>();
const { t } = useI18n();
</script>

<template>
  <span v-if="props.source" v-tooltip.top="t(`unlockTimeSource.${props.source}`)">
    <DateTimeText :value="props.time" />
    <i v-if="props.source === 'estimated'" class="pi pi-question-circle app-muted" />
    <i v-if="props.source === 'manual' || props.source === 'csv'" class="pi pi-pencil app-muted" />
  </span>
</template>
