<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputText from 'primevue/inputtext';
import Menu from 'primevue/menu';
import type { MenuItem } from 'primevue/menuitem';
import MultiSelect from 'primevue/multiselect';

import WarningDialog from '@/components/admin/WarningDialog.vue';
import InactivityText from '@/components/ui/InactivityText.vue';
import SlotTable from '@/components/ui/SlotTable.vue';

import type { LockStatus, SlotRow } from '@/api/types';
import type { InactivityLevel } from '@/domain/inactivity';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useInactivityStore } from '@/stores/inactivity';
import { useInactivityReminderStore } from '@/stores/inactivity-reminder';
import { useStatisticsStore } from '@/stores/statistics';
import { useTableFiltersStore } from '@/stores/table-filters';
import { useWarningsStore } from '@/stores/warnings';

const filters = useTableFiltersStore();
const { roster, filteredRoster } = storeToRefs(filters);
const { hoursBySlotId, levelBySlotId } = storeToRefs(useInactivityStore());
const { isAdmin, isHelper } = storeToRefs(useCurrentRoomStore());
const warningsStore = useWarningsStore();
const { countBySlotId } = storeToRefs(warningsStore);
const reminder = useInactivityReminderStore();
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

const slotMenu = useTemplateRef<InstanceType<typeof Menu>>('slotMenu');
const menuSlot = ref<SlotRow | null>(null);

const slotMenuItems = computed<MenuItem[]>(() => {
  const slot = menuSlot.value;
  if (!slot) {
    return [];
  }
  return [
    {
      label: t('roster.copyReminder'),
      icon: 'pi pi-copy',
      disabled: !reminder.canRemind(slot.id),
      command: () => void reminder.copyForSlot(slot.id),
    },
    ...(isAdmin.value
      ? [
          {
            label: t('warnings.add'),
            icon: 'pi pi-exclamation-triangle',
            command: () => warningsStore.startDraft(slot.id),
          },
        ]
      : []),
  ];
});

const openSlotMenu = (event: MouseEvent, slot: SlotRow) => {
  menuSlot.value = slot;
  slotMenu.value?.toggle(event);
};
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
    >
      <template v-if="isHelper" #inactivity="{ row }">
        <button
          type="button"
          class="inactivity-action"
          data-testid="inactivity-action"
          @click="openSlotMenu($event, row)"
        >
          <InactivityText :hours="hoursBySlotId.get(row.id) ?? null" :level="levelBySlotId.get(row.id) ?? 'none'" />
          <i class="pi pi-angle-down" />
        </button>
      </template>
    </SlotTable>
    <Menu ref="slotMenu" :model="slotMenuItems" popup data-testid="slot-menu" />
    <WarningDialog v-if="isAdmin" />
  </section>
</template>

<style scoped>
.inactivity-action {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.inactivity-action .pi {
  font-size: 0.75rem;
}
</style>
