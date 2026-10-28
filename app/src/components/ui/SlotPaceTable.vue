<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import Column from 'primevue/column';
import DataTable, { type DataTableSortEvent } from 'primevue/datatable';
import Tag from 'primevue/tag';

import DateTimeText from './DateTimeText.vue';

import type { SlotPace } from '@/api/types';
import { formatDuration } from '@/domain/duration';
import { formatGameName } from '@/domain/game-name';
import { activeCycleField, cycleSortField, nextTableSort, type SortCycle, type TableSort } from '@/domain/table-sort';

type PaceMark = 'estimated' | 'unknown' | 'partialSignals';

const props = defineProps<{ rows: SlotPace[] }>();
const { t, n } = useI18n();

const rowCountBySlotId = computed(() => {
  const counts = new Map<number, number>();
  for (const row of props.rows) {
    counts.set(row.slotId, (counts.get(row.slotId) ?? 0) + 1);
  }
  return counts;
});

const marksOf = (row: SlotPace): PaceMark[] => [
  ...(row.startKind === 'estimated' || row.startKind === 'unknown' ? [row.startKind] : []),
  ...(row.partialSignals ? (['partialSignals'] as const) : []),
];

const tableRows = computed(() =>
  props.rows.map((row, index) => {
    const marks = marksOf(row);
    return {
      ...row,
      key: `${row.slotId}-${index}`,
      gameName: formatGameName(row.game),
      hasMoreRows: (rowCountBySlotId.value.get(row.slotId) ?? 0) > 1,
      bkSharePercentage: row.bkShare === null ? null : Math.round(row.bkShare * 100),
      marks,
      markCount: marks.length,
    };
  }),
);

type Row = (typeof tableRows.value)[number];

const sort = ref<TableSort>({ field: null, order: null });
const SLOT_SORT: SortCycle = { first: 'name', second: 'gameName' };
const TIME_SORT: SortCycle = { first: 'from', second: 'to' };
const ACTIVE_SORT: SortCycle = { first: 'activeMinutes', second: 'checks' };
const PACE_SORT: SortCycle = { first: 'checksPerHour', second: 'minutesPerCheck' };
const BK_SORT: SortCycle = { first: 'bkMinutes', second: 'bkSharePercentage' };
const BK_PERIODS_SORT: SortCycle = { first: 'bkCount', second: 'longestBkMinutes' };
const SORT_CYCLES = [SLOT_SORT, TIME_SORT, ACTIVE_SORT, PACE_SORT, BK_SORT, BK_PERIODS_SORT];

const cycleHeader = (columnKey: string, cycle: SortCycle, modeKeys: [string, string]): string => {
  const column = t(`pace.columns.${columnKey}`);
  const active = activeCycleField(sort.value, cycle);
  if (active === null) {
    return column;
  }
  return t('slot.sortMode', { column, mode: t(`pace.sortModes.${modeKeys[active === 'first' ? 0 : 1]}`) });
};
const slotHeader = computed(() => cycleHeader('slotGame', SLOT_SORT, ['slot', 'game']));
const timeHeader = computed(() => cycleHeader('playerTime', TIME_SORT, ['from', 'to']));
const activeHeader = computed(() => cycleHeader('activeChecks', ACTIVE_SORT, ['time', 'checks']));
const paceHeader = computed(() => cycleHeader('pace', PACE_SORT, ['pace', 'perCheck']));
const bkHeader = computed(() => cycleHeader('bkTime', BK_SORT, ['time', 'share']));
const bkPeriodsHeader = computed(() => cycleHeader('bkPeriods', BK_PERIODS_SORT, ['count', 'longest']));

const onSort = (event: DataTableSortEvent): void => {
  const field = typeof event.sortField === 'string' ? event.sortField : null;
  const order = event.sortOrder === 1 || event.sortOrder === -1 ? event.sortOrder : null;
  sort.value = nextTableSort(sort.value, { field, order }, SORT_CYCLES);
};

const duration = (minutes: number | null): string => (minutes === null ? '' : formatDuration(minutes));
const decimal = (value: number | null): string => (value === null ? '' : n(value, 'decimal'));
</script>

<template>
  <DataTable
    :value="tableRows"
    data-key="key"
    :sort-field="sort.field ?? undefined"
    :sort-order="sort.order ?? undefined"
    removable-sort
    striped-rows
    size="small"
    class="pace-table"
    data-testid="slot-pace-table"
    @sort="onSort"
  >
    <template #empty>{{ t('pace.emptySlots') }}</template>
    <Column field="name" :sort-field="cycleSortField(sort, SLOT_SORT)" :header="slotHeader" sortable>
      <template #body="{ data }">
        <slot name="slot" :row="data as Row">
          <span class="wrap-anywhere">{{ (data as Row).name }}</span>
        </slot>
        <span class="app-muted second-line" :title="(data as Row).game">{{ (data as Row).gameName }}</span>
      </template>
    </Column>
    <Column field="discordName" :header="t('pace.columns.discord')" sortable>
      <template #body="{ data }">
        <span v-if="(data as Row).discordName" class="wrap-anywhere">{{ (data as Row).discordName }}</span>
        <span v-else class="app-muted">{{ t('pace.noPlayer') }}</span>
      </template>
    </Column>
    <Column field="from" :sort-field="cycleSortField(sort, TIME_SORT)" :header="timeHeader" sortable>
      <template #body="{ data }">
        <span v-if="(data as Row).hasMoreRows" class="player-time" data-testid="pace-player-time">
          <DateTimeText :value="(data as Row).from" />
          <DateTimeText :value="(data as Row).to" />
        </span>
      </template>
    </Column>
    <Column field="activeMinutes" :sort-field="cycleSortField(sort, ACTIVE_SORT)" :header="activeHeader" sortable>
      <template #body="{ data }">
        <span class="stack">
          <span>{{ duration((data as Row).activeMinutes) }}</span>
          <span v-if="(data as Row).checks !== null" class="app-muted">
            {{ t('pace.checksCount', { count: (data as Row).checks }) }}
          </span>
        </span>
      </template>
    </Column>
    <Column field="checksPerHour" :sort-field="cycleSortField(sort, PACE_SORT)" :header="paceHeader" sortable>
      <template #body="{ data }">
        <span class="stack">
          <span data-testid="pace-value">{{ decimal((data as Row).checksPerHour) }}</span>
          <span v-if="(data as Row).minutesPerCheck !== null" class="app-muted">
            {{ t('pace.minutesPerCheck', { value: decimal((data as Row).minutesPerCheck) }) }}
          </span>
        </span>
      </template>
    </Column>
    <Column field="bkMinutes" :sort-field="cycleSortField(sort, BK_SORT)" :header="bkHeader" sortable>
      <template #body="{ data }">
        <span class="stack">
          <span>{{ duration((data as Row).bkMinutes) }}</span>
          <span v-if="(data as Row).bkSharePercentage !== null" class="app-muted">
            {{ t('statistics.percentage', { value: (data as Row).bkSharePercentage }) }}
          </span>
        </span>
      </template>
    </Column>
    <Column field="bkCount" :sort-field="cycleSortField(sort, BK_PERIODS_SORT)" :header="bkPeriodsHeader" sortable>
      <template #body="{ data }">
        <span class="stack">
          <span>{{ (data as Row).bkCount ?? '' }}</span>
          <span v-if="(data as Row).bkCount && (data as Row).longestBkMinutes !== null" class="app-muted wrap">
            {{ t('pace.longest', { duration: duration((data as Row).longestBkMinutes) }) }}
          </span>
        </span>
      </template>
    </Column>
    <Column field="breakMinutes" :header="t('pace.columns.breaks')" sortable>
      <template #body="{ data }">
        <span class="nowrap">{{ duration((data as Row).breakMinutes) }}</span>
      </template>
    </Column>
    <Column field="markCount" :header="t('pace.columns.data')" sortable>
      <template #body="{ data }">
        <span class="stack">
          <Tag
            v-for="mark in (data as Row).marks"
            :key="mark"
            v-tooltip.top="t(`pace.markHints.${mark}`)"
            :value="t(`pace.marks.${mark}`)"
            severity="warn"
            :data-testid="`pace-mark-${mark}`"
          />
        </span>
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.pace-table {
  font-size: 0.8125rem;
}

.pace-table :deep(th),
.pace-table :deep(td) {
  padding: 0.3rem 0.375rem;
  vertical-align: top;
}

.pace-table :deep(th) {
  white-space: normal;
  font-size: 0.75rem;
}

.pace-table :deep(.p-tag) {
  font-size: 0.7rem;
  padding: 0.1rem 0.35rem;
  white-space: normal;
}

.player-time,
.stack {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  white-space: nowrap;
}

.second-line {
  display: block;
  font-size: 0.7rem;
}

.wrap-anywhere {
  overflow-wrap: anywhere;
}

.wrap {
  white-space: normal;
}

.nowrap {
  white-space: nowrap;
}
</style>
