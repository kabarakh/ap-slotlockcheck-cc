<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Message from 'primevue/message';
import Textarea from 'primevue/textarea';

import UnlockTimeDialog from './UnlockTimeDialog.vue';
import LockStatusTag from '@/components/ui/LockStatusTag.vue';
import UnlockTimeText from '@/components/ui/UnlockTimeText.vue';

import { useUnlockTimesStore } from '@/stores/unlock-times';

const unlockTimes = useUnlockTimesStore();
const { unlockedPairs, csv, importResult, busy } = storeToRefs(unlockTimes);
const { t } = useI18n();

const onFileSelected = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    await unlockTimes.loadCsvFile(file);
  }
};
</script>

<template>
  <section class="unlock-times">
    <h2>{{ t('unlockTimes.listTitle') }}</h2>
    <table class="unlock-table">
      <thead>
        <tr>
          <th>{{ t('slot.columns.name') }}</th>
          <th>{{ t('unlockTimes.locker') }}</th>
          <th>{{ t('slot.columns.unlockedBy') }}</th>
          <th>{{ t('slot.columns.unlockTime') }}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr v-for="pair in unlockedPairs" :key="pair.key">
          <td>#{{ pair.slot.position }} {{ pair.slot.name }} <LockStatusTag :status="pair.slot.lockStatus" /></td>
          <td>{{ pair.lock.lockerName }}</td>
          <td>{{ pair.lock.senderName }}</td>
          <td><UnlockTimeText :time="pair.lock.unlockTime" :source="pair.lock.timeSource" /></td>
          <td>
            <Button
              icon="pi pi-pencil"
              size="small"
              text
              :aria-label="t('unlockTimes.edit')"
              @click="unlockTimes.startDraft(pair.lock.lockerSlotId, pair.slot.id, pair.lock.unlockTime)"
            />
          </td>
        </tr>
      </tbody>
    </table>

    <h2>{{ t('unlockTimes.csvTitle') }}</h2>
    <p class="app-muted">{{ t('unlockTimes.csvHint') }}</p>
    <input type="file" accept=".csv,text/csv" @change="onFileSelected" />
    <Textarea v-model="csv" rows="6" auto-resize class="csv-input" data-testid="csv-input" />
    <div class="app-toolbar">
      <Button
        :label="t('unlockTimes.import')"
        :disabled="csv.trim().length === 0"
        :loading="busy"
        data-testid="csv-import"
        @click="unlockTimes.importCsv()"
      />
    </div>
    <Message v-if="importResult" :severity="importResult.errors.length > 0 ? 'warn' : 'success'">
      <p>{{ t('unlockTimes.imported', { count: importResult.updated }) }}</p>
      <ul v-if="importResult.errors.length > 0">
        <li v-for="error in importResult.errors" :key="error">{{ error }}</li>
      </ul>
    </Message>
    <UnlockTimeDialog />
  </section>
</template>

<style scoped>
.unlock-times {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.unlock-table {
  border-collapse: collapse;
}

.unlock-table th,
.unlock-table td {
  border-bottom: 1px solid var(--p-content-border-color);
  padding: 0.25rem 0.75rem;
  text-align: left;
}

.csv-input {
  font-family: monospace;
}
</style>
