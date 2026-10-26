<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';

import { useAdminStore } from '@/stores/admin';
import { useCurrentRoomStore } from '@/stores/current-room';

const admin = useAdminStore();
const { busy } = storeToRefs(admin);
const { selectedLockers, playableSlots } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();
</script>

<template>
  <section>
    <p class="app-muted">{{ t('locks.intro') }}</p>
    <table class="lock-matrix" data-testid="lock-matrix">
      <thead>
        <tr>
          <th>{{ t('slot.columns.name') }}</th>
          <th v-for="locker in selectedLockers" :key="locker.id">{{ locker.name }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="slot in playableSlots" :key="slot.id">
          <td>#{{ slot.position }} {{ slot.name }}</td>
          <td v-for="locker in selectedLockers" :key="locker.id">
            <span class="app-toolbar">
              <Checkbox
                binary
                :model-value="admin.isLocked(locker.id, slot.id)"
                :disabled="busy"
                :aria-label="t('locks.toggle', { locker: locker.name, slot: slot.name })"
                @update:model-value="(locked: boolean) => admin.setLock(locker.id, slot.id, locked)"
              />
              <Button
                v-if="admin.isOverridden(locker.id, slot.id)"
                v-tooltip.top="t('locks.reset')"
                icon="pi pi-undo"
                size="small"
                text
                rounded
                :aria-label="t('locks.reset')"
                @click="admin.resetLock(locker.id, slot.id)"
              />
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.lock-matrix {
  border-collapse: collapse;
}

.lock-matrix th,
.lock-matrix td {
  border-bottom: 1px solid var(--p-content-border-color);
  padding: 0.25rem 0.75rem;
  text-align: left;
}
</style>
