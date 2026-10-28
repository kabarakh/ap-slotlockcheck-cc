<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Drawer from 'primevue/drawer';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';

import PaceTimeline from '@/components/ui/PaceTimeline.vue';

import { usePaceStore } from '@/stores/pace';

const paceStore = usePaceStore();
const { timelineRow, timeline, timelineLoading, timelineError } = storeToRefs(paceStore);
const { t, d } = useI18n();

const visible = computed({
  get: () => timelineRow.value !== null,
  set: (value: boolean) => {
    if (!value) {
      paceStore.closeTimeline();
    }
  },
});

const highlight = computed(() =>
  timelineRow.value?.from && timelineRow.value.to ? { from: timelineRow.value.from, to: timelineRow.value.to } : null,
);

const rowText = computed(() =>
  timelineRow.value && highlight.value
    ? t('pace.timeline.row', {
        player: timelineRow.value.discordName ?? t('pace.noPlayer'),
        from: d(new Date(highlight.value.from), 'dateTime'),
        to: d(new Date(highlight.value.to), 'dateTime'),
      })
    : '',
);
</script>

<template>
  <Drawer
    v-model:visible="visible"
    position="right"
    :header="t('pace.timeline.title', { slot: timelineRow?.name ?? '' })"
    class="pace-timeline-drawer"
    data-testid="pace-timeline-drawer"
  >
    <div class="content">
      <p v-if="rowText" class="app-muted" data-testid="pace-timeline-row">{{ rowText }}</p>
      <Message v-if="timelineError" severity="warn" :closable="false" data-testid="pace-timeline-error">
        {{ t(`errors.${timelineError}`) }}
      </Message>
      <ProgressSpinner v-else-if="timelineLoading && !timeline" />
      <template v-else-if="timeline && timelineRow">
        <p class="app-muted">{{ t('pace.timeline.hint') }}</p>
        <PaceTimeline :timeline="timeline" :highlight="highlight" :slot-name="timelineRow.name" />
      </template>
    </div>
  </Drawer>
</template>

<style>
.p-drawer-right .pace-timeline-drawer.p-drawer {
  width: min(60rem, 100vw);
}
</style>

<style scoped>
.content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.content p {
  margin: 0;
}
</style>
