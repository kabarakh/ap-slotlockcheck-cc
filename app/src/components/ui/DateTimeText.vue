<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps<{ value: string | null }>();
const { d, t } = useI18n();

const text = computed(() => (props.value ? d(new Date(props.value), 'dateTime') : t('common.none')));
</script>

<template>
  <time v-if="props.value" :datetime="props.value">{{ text }}</time>
  <span v-else class="app-muted">{{ text }}</span>
</template>
