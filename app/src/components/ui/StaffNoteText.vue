<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { StaffNote } from '@/api/types';

const props = defineProps<{ note: StaffNote | null | undefined; kind: 'public' | 'internal' }>();
const { d, t } = useI18n();

const changed = computed(() =>
  props.note
    ? t('notes.changed', { name: props.note.updatedByName, date: d(new Date(props.note.updatedAt), 'dateTime') })
    : '',
);
</script>

<template>
  <span
    v-if="props.note && props.note.text.length > 0"
    v-tooltip.top="changed"
    class="staff-note"
    :class="props.kind"
    :data-testid="`staff-note-${props.kind}`"
  >
    <i :class="props.kind === 'public' ? 'pi pi-megaphone' : 'pi pi-lock'" />
    <span>{{ props.note.text }}</span>
  </span>
</template>

<style scoped>
.staff-note {
  display: flex;
  gap: 0.3rem;
  align-items: baseline;
  padding: 0.15rem 0.35rem;
  border-left: 3px solid var(--p-primary-color);
  background: var(--p-content-hover-background);
  border-radius: 0.2rem;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.staff-note.internal {
  border-left-color: var(--p-orange-500);
}

.staff-note .pi {
  font-size: 0.7rem;
  flex: none;
}
</style>
