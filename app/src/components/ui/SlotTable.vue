<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import Column from 'primevue/column';
import DataTable, { type DataTableSortEvent } from 'primevue/datatable';

import CheeseStatusTag from './CheeseStatusTag.vue';
import DateTimeText from './DateTimeText.vue';
import InactivityText from './InactivityText.vue';
import LockStatusTag from './LockStatusTag.vue';
import UnlockInfo from './UnlockInfo.vue';

import type { SlotRow } from '@/api/types';
import { goalTimeSortKey, STATUS_SORT, statusSortKey } from '@/domain/completion-order';
import { formatGameName } from '@/domain/game-name';
import type { InactivityLevel } from '@/domain/inactivity';
import { checksPercentage, isGoaled } from '@/domain/summary';
import { activeCycleField, cycleSortField, nextTableSort, type SortCycle, type TableSort } from '@/domain/table-sort';
import { lastUnlockTimeKey, UNLOCK_SORT, unlockSenderKey } from '@/domain/unlock-order';

const props = defineProps<{
  slots: SlotRow[];
  hoursBySlotId: Map<number, number | null>;
  levelBySlotId: Map<number, InactivityLevel>;
  warningCountBySlotId: ReadonlyMap<number, number> | null;
  showLocks: boolean;
  testId: string;
}>();
const { t } = useI18n();

const otherArchipelagoName = (slot: SlotRow): string | null =>
  slot.archipelagoName && !slot.name.includes(slot.archipelagoName) ? slot.archipelagoName : null;

const rows = computed(() =>
  props.slots.map((slot) => ({
    ...slot,
    gameName: formatGameName(slot.game),
    statusOrder: statusSortKey(slot),
    goalTimeOrder: goalTimeSortKey(slot),
    unlockSender: unlockSenderKey(slot),
    lastUnlockTime: lastUnlockTimeKey(slot),
    checksPercentage: checksPercentage(slot.checksDone, slot.checksTotal),
    inactivityHours: props.hoursBySlotId.get(slot.id) ?? -1,
    warningCount: props.warningCountBySlotId?.get(slot.id) ?? 0,
  })),
);

type Row = (typeof rows.value)[number];

const sort = ref<TableSort>({ field: 'position', order: 1 });
const CHECKS_SORT: SortCycle = { first: 'checksDone', second: 'checksPercentage' };
const SORT_CYCLES = [UNLOCK_SORT, CHECKS_SORT, STATUS_SORT];

const cycleHeader = (columnKey: string, cycle: SortCycle, modeKeys: [string, string]): string => {
  const column = t(`slot.columns.${columnKey}`);
  const active = activeCycleField(sort.value, cycle);
  if (active === null) {
    return column;
  }
  return t('slot.sortMode', { column, mode: t(`slot.sortModes.${modeKeys[active === 'first' ? 0 : 1]}`) });
};
const unlockHeader = computed(() => cycleHeader('unlockedBy', UNLOCK_SORT, ['person', 'time']));
const checksHeader = computed(() => cycleHeader('checks', CHECKS_SORT, ['count', 'percentage']));
const statusHeader = computed(() => cycleHeader('cheeseStatus', STATUS_SORT, ['status', 'goalTime']));

const onSort = (event: DataTableSortEvent): void => {
  const field = typeof event.sortField === 'string' ? event.sortField : null;
  const order = event.sortOrder === 1 || event.sortOrder === -1 ? event.sortOrder : null;
  sort.value = nextTableSort(sort.value, { field, order }, SORT_CYCLES);
};
</script>

<template>
  <DataTable
    :value="rows"
    data-key="id"
    :sort-field="sort.field ?? undefined"
    :sort-order="sort.order ?? undefined"
    removable-sort
    striped-rows
    size="small"
    class="slot-table"
    :data-testid="props.testId"
    @sort="onSort"
  >
    <template #empty>{{ t('slot.empty') }}</template>
    <Column field="position" :header="t('slot.columns.position')" sortable />
    <Column field="name" :header="t('slot.columns.name')" sortable>
      <template #body="{ data }">
        <span>{{ (data as Row).name }}</span>
        <span
          v-if="(data as Row).warningCount > 0"
          v-tooltip.top="t('slot.warningCount', { count: (data as Row).warningCount })"
          class="warning-badge"
          data-testid="warning-badge"
        >
          <i class="pi pi-exclamation-triangle" />{{ (data as Row).warningCount }}
        </span>
        <span v-if="otherArchipelagoName(data as Row)" class="app-muted second-line">
          {{ otherArchipelagoName(data as Row) }}
        </span>
      </template>
    </Column>
    <Column field="discordName" :header="t('slot.columns.discord')" sortable>
      <template #body="{ data }">
        <span v-if="(data as Row).discordName">{{ (data as Row).discordName }}</span>
        <span v-else class="app-muted">{{ t(`availability.${(data as Row).availabilityStatus}`) }}</span>
      </template>
    </Column>
    <Column field="gameName" :header="t('slot.columns.game')" sortable>
      <template #body="{ data }">
        <span :title="(data as Row).game">{{ (data as Row).gameName }}</span>
      </template>
    </Column>
    <Column v-if="props.showLocks" field="lockStatus" :header="t('slot.columns.lockStatus')" sortable>
      <template #body="{ data }">
        <LockStatusTag :status="(data as Row).lockStatus" />
      </template>
    </Column>
    <Column
      v-if="props.showLocks"
      field="unlockTime"
      :sort-field="cycleSortField(sort, UNLOCK_SORT)"
      :header="unlockHeader"
      sortable
    >
      <template #body="{ data }">
        <UnlockInfo :locks="(data as Row).locks" />
      </template>
    </Column>
    <Column field="inactivityHours" :header="t('slot.columns.inactivity')" sortable>
      <template #body="{ data }">
        <slot name="inactivity" :row="data as Row">
          <InactivityText
            :hours="props.hoursBySlotId.get((data as Row).id) ?? null"
            :level="props.levelBySlotId.get((data as Row).id) ?? 'none'"
          />
        </slot>
      </template>
    </Column>
    <Column field="checksDone" :sort-field="cycleSortField(sort, CHECKS_SORT)" :header="checksHeader" sortable>
      <template #body="{ data }">
        <span class="nowrap">{{ (data as Row).checksDone }} / {{ (data as Row).checksTotal }}</span>
        <span class="app-muted nowrap check-percentage">
          {{ t('statistics.percentage', { value: (data as Row).checksPercentage }) }}
        </span>
      </template>
    </Column>
    <Column field="completionStatus" :sort-field="cycleSortField(sort, STATUS_SORT)" :header="statusHeader" sortable>
      <template #body="{ data }">
        <span class="status-stack">
          <CheeseStatusTag
            v-if="(data as Row).completionStatus !== 'incomplete'"
            kind="completion"
            :value="(data as Row).completionStatus"
          />
          <span
            v-if="(data as Row).goalTime"
            v-tooltip.top="t(`goalTimeSource.${(data as Row).goalTimeSource}`)"
            class="goal-time app-muted"
            data-testid="goal-time"
          >
            <DateTimeText :value="(data as Row).goalTime" />
            <i v-if="(data as Row).goalTimeSource === 'estimated'" class="pi pi-question-circle" />
          </span>
          <CheeseStatusTag v-if="!isGoaled(data as Row)" kind="progression" :value="(data as Row).progressionStatus" />
        </span>
      </template>
    </Column>
    <Column field="notes" :header="t('slot.columns.notes')">
      <template #body="{ data }">
        <span class="notes">{{ (data as Row).notes }}</span>
      </template>
    </Column>
    <Column v-if="props.showLocks" field="unlocksSent" :header="t('slot.columns.unlocksSent')" sortable />
  </DataTable>
</template>

<style scoped>
.slot-table {
  font-size: 0.8125rem;
}

.slot-table :deep(th),
.slot-table :deep(td) {
  padding: 0.3rem 0.375rem;
  vertical-align: top;
}

.slot-table :deep(th) {
  white-space: normal;
  font-size: 0.75rem;
}

.slot-table :deep(.p-datatable-column-header-content) {
  gap: 0.15rem;
}

.slot-table :deep(.p-datatable-sort-icon) {
  width: 0.7rem;
  height: 0.7rem;
}

.status-stack {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
}

.slot-table :deep(.p-tag) {
  font-size: 0.7rem;
  padding: 0.1rem 0.35rem;
  white-space: nowrap;
}

.warning-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  margin-left: 0.3rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--p-red-500);
}

.second-line {
  display: block;
  font-size: 0.7rem;
}

.nowrap {
  white-space: nowrap;
}

.goal-time {
  font-size: 0.7rem;
  white-space: nowrap;
}

.check-percentage {
  margin-left: 0.35rem;
}

.notes {
  display: block;
  max-width: 14rem;
  overflow-wrap: anywhere;
}
</style>
