<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Message from 'primevue/message';
import ProgressBar from 'primevue/progressbar';
import DateTimeText from '@/components/ui/DateTimeText.vue';
import { useServerAdminStore } from '@/stores/server-admin';

const serverAdmin = useServerAdminStore();
const { job, jobRunning } = storeToRefs(serverAdmin);
const { t } = useI18n();

const percentage = computed(() => {
  const current = job.value;
  return !current || current.total === 0 ? 100 : Math.round((current.done / current.total) * 100);
});
</script>

<template>
  <section v-if="job" class="app-form job" data-testid="server-job">
    <h3>{{ t('server.job.title', { command: t(`server.commands.${job.command}`) }) }}</h3>
    <ProgressBar :value="percentage" />
    <p data-testid="server-job-state">
      {{ t(`server.job.states.${job.state}`) }}
      {{ t('server.job.progress', { done: job.done, total: job.total }) }}
      <DateTimeText :value="job.startedAt" />
    </p>
    <div v-if="jobRunning" class="app-toolbar">
      <Button :label="t('server.job.stop')" severity="danger" size="small" @click="serverAdmin.stopJob()" />
    </div>
    <Message v-if="job.errors.length > 0" severity="error" :closable="false">
      <p>{{ t('server.job.errors') }}</p>
      <ul>
        <li v-for="(error, index) in job.errors" :key="index">{{ error }}</li>
      </ul>
    </Message>
  </section>
</template>

<style scoped>
.job {
  margin-top: 1.5rem;
}
</style>
