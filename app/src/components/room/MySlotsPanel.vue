<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';

import SlotTable from '@/components/ui/SlotTable.vue';

import type { LockStatus } from '@/api/types';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useInactivityStore } from '@/stores/inactivity';
import { useTableFiltersStore } from '@/stores/table-filters';

const filters = useTableFiltersStore();
const { mySlots, filteredMySlots } = storeToRefs(filters);
const { hoursBySlotId, levelBySlotId } = storeToRefs(useInactivityStore());
const { hasSlotLock } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

const lockStatusOptions = computed(() =>
  (['not_locked', 'start_slot', 'locked', 'partially_unlocked', 'unlocked'] as LockStatus[]).map((value) => ({
    value,
    label: t(`lockStatus.${value}`),
  })),
);
</script>

<template>
  <section>
    <div class="app-toolbar">
      <InputText v-model="mySlots.text" :placeholder="t('filters.search')" size="small" />
      <MultiSelect
        v-if="hasSlotLock"
        v-model="mySlots.lockStatuses"
        :options="lockStatusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('filters.lockStatus')"
        size="small"
        display="chip"
      />
      <Button :label="t('filters.reset')" size="small" text @click="filters.resetMySlotsFilter()" />
    </div>
    <SlotTable
      :slots="filteredMySlots"
      :hours-by-slot-id="hoursBySlotId"
      :level-by-slot-id="levelBySlotId"
      :warning-count-by-slot-id="null"
      :show-locks="hasSlotLock"
      test-id="my-slots-table"
    />
  </section>
</template>
