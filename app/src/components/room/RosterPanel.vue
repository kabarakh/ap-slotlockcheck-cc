<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';

import SlotTable from '@/components/ui/SlotTable.vue';

import type { LockStatus } from '@/api/types';
import type { InactivityLevel } from '@/domain/inactivity';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useInactivityStore } from '@/stores/inactivity';
import { useStatisticsStore } from '@/stores/statistics';
import { useWarningsStore } from '@/stores/warnings';
import { useTableFiltersStore } from '@/stores/table-filters';

const filters = useTableFiltersStore();
const { roster, filteredRoster } = storeToRefs(filters);
const { hoursBySlotId, levelBySlotId } = storeToRefs(useInactivityStore());
const { isAdmin } = storeToRefs(useCurrentRoomStore());
const { countBySlotId } = storeToRefs(useWarningsStore());
const { globalStatistics } = storeToRefs(useStatisticsStore());
const { t } = useI18n();

const lockStatusOptions = computed(() =>
  (['not_locked', 'start_slot', 'locked', 'partially_unlocked', 'unlocked'] as LockStatus[]).map((value) => ({
    value,
    label: t(`lockStatus.${value}`),
  })),
);
const inactivityOptions = computed(() =>
  (['none', 'yellow', 'red'] as InactivityLevel[]).map((value) => ({ value, label: t(`inactivity.level.${value}`) })),
);
</script>

<template>
  <section>
    <div class="app-toolbar">
      <InputText v-model="roster.text" :placeholder="t('filters.search')" size="small" data-testid="roster-search" />
      <MultiSelect
        v-model="roster.lockStatuses"
        :options="lockStatusOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('filters.lockStatus')"
        size="small"
        display="chip"
      />
      <MultiSelect
        v-model="roster.inactivityLevels"
        :options="inactivityOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('filters.inactivity')"
        size="small"
        display="chip"
      />
      <label class="app-toolbar">
        <Checkbox v-model="roster.hideSlotLockSlots" binary />
        {{ t('filters.hideSlotLock') }}
      </label>
      <Button :label="t('filters.reset')" size="small" text @click="filters.resetRosterFilter()" />
    </div>
    <p class="app-muted" data-testid="roster-checks">
      {{
        t('roster.checks', {
          done: globalStatistics.checksDone,
          total: globalStatistics.checksTotal,
          percentage: globalStatistics.checksPercentage,
          locked: globalStatistics.openChecksInLockedSlots,
        })
      }}
    </p>
    <SlotTable
      :slots="filteredRoster"
      :hours-by-slot-id="hoursBySlotId"
      :level-by-slot-id="levelBySlotId"
      :warning-count-by-slot-id="isAdmin ? countBySlotId : null"
      test-id="roster-table"
    />
  </section>
</template>
