<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Tag from 'primevue/tag';

type StatusKind = 'progression' | 'completion' | 'availability';

const props = defineProps<{ kind: StatusKind; value: string }>();
const { t } = useI18n();

const SEVERITIES: Record<StatusKind, Record<string, string>> = {
  progression: { bk: 'danger', soft_bk: 'warn', go: 'success', unblocked: 'info', unknown: 'secondary' },
  completion: { goal: 'success', done: 'success', released: 'contrast', all_checks: 'info', incomplete: 'secondary' },
  availability: { open: 'warn', claimed: 'secondary', public: 'info', unknown: 'secondary' },
};

const severity = computed(() => SEVERITIES[props.kind][props.value] ?? 'secondary');
</script>

<template>
  <Tag :severity="severity" :value="t(`${props.kind}.${props.value}`)" />
</template>
