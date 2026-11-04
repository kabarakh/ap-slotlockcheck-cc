<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';

import BarChart from '@/components/ui/BarChart.vue';
import StatisticFacts from '@/components/ui/StatisticFacts.vue';
import StatisticSection from '@/components/ui/StatisticSection.vue';
import TimeLineChart from '@/components/ui/TimeLineChart.vue';

import type { ChartBar } from '@/domain/charts';
import { formatLongDuration } from '@/domain/duration';
import type { LineSeries } from '@/domain/statistics-charts';
import { durationHistogram, median } from '@/domain/statistics-time';
import {
  leadTimes,
  reactionTimes,
  unlockCurve,
  unlockedWithoutChecks,
  waitTimes,
  type SlotDuration,
} from '@/domain/unlock-statistics';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useRoomHistoryStore } from '@/stores/room-history';
import { useStatisticsStore } from '@/stores/statistics';

const historyStore = useRoomHistoryStore();
const { history, unavailable } = storeToRefs(historyStore);
const { slots: allSlots } = storeToRefs(useCurrentRoomStore());
const { filteredSlots: slots } = storeToRefs(useStatisticsStore());
const { t } = useI18n();

onMounted(() => historyStore.open());
onUnmounted(() => historyStore.close());

const now = computed(() => (history.value ? new Date(history.value.calculatedAt).getTime() : Date.now()));
const start = computed(() => (history.value?.startedAt ? new Date(history.value.startedAt).getTime() : null));
const medianText = (values: number[]) => {
  const value = median(values);
  return value === null ? t('common.none') : formatLongDuration(value);
};

const hasValues = (bars: ChartBar[]) => bars.some((bar) => bar.value > 0);

const curve = computed(() => unlockCurve(slots.value));
const curveSeries = computed<LineSeries[]>(() => {
  const points = curve.value.points;
  if (points.length === 0) {
    return [];
  }
  const first = start.value !== null && start.value < (points[0]?.time ?? 0) ? [{ time: start.value, value: 0 }] : [];
  const last = points[points.length - 1];
  const end = last && now.value > last.time ? [{ time: now.value, value: last.value }] : [];
  return [
    {
      key: 'unlocked',
      label: t('statistics.unlockCurve.series'),
      color: 'unlocks',
      points: [...first, ...points, ...end],
      filled: true,
    },
  ];
});
const curveHints = computed(() =>
  curve.value.withoutTimeCount > 0
    ? t('statistics.unlockCurve.withoutTime', { count: curve.value.withoutTimeCount })
    : undefined,
);

const waits = computed(() => (start.value === null ? null : waitTimes(slots.value, start.value, now.value)));
interface WaitRow extends SlotDuration {
  stillLocked: boolean;
}
const waitRows = computed<WaitRow[]>(() =>
  waits.value === null
    ? []
    : [
        ...waits.value.stillLocked.map((row) => ({ ...row, stillLocked: true })),
        ...waits.value.unlocked.map((row) => ({ ...row, stillLocked: false })),
      ],
);
const waitBars = computed(() => durationHistogram((waits.value?.unlocked ?? []).map((row) => row.minutes)));
const waitFacts = computed(() => [
  {
    key: 'wait-median',
    label: t('statistics.median'),
    value: medianText((waits.value?.unlocked ?? []).map((row) => row.minutes)),
  },
  {
    key: 'wait-still-locked',
    label: t('statistics.waits.stillLocked'),
    value: String(waits.value?.stillLocked.length ?? 0),
  },
]);

const firstChecks = computed(
  () => new Map((history.value?.slots ?? []).map((slot) => [slot.slotId, slot.firstCheckTime])),
);
const reactions = computed(() => reactionTimes(slots.value, firstChecks.value));
const reactionBars = computed(() => durationHistogram(reactions.value.map((row) => row.minutes)));
const idle = computed(() => unlockedWithoutChecks(slots.value, now.value));
const reactionFacts = computed(() => [
  {
    key: 'reaction-median',
    label: t('statistics.median'),
    value: medianText(reactions.value.map((row) => row.minutes)),
  },
  { key: 'reaction-count', label: t('statistics.reactions.measured'), value: String(reactions.value.length) },
  { key: 'reaction-idle', label: t('statistics.reactions.withoutChecks'), value: String(idle.value.length) },
]);

const leads = computed(() => leadTimes(slots.value, allSlots.value));
const leadBars = computed(() => durationHistogram(leads.value.rows.map((row) => row.minutes)));
const leadFacts = computed(() => [
  {
    key: 'lead-pairs',
    label: t('statistics.leads.withLaterItems'),
    value: t('statistics.leads.pairs', {
      count: leads.value.pairsWithLaterItems,
      total: leads.value.unlockedPairCount,
    }),
  },
  { key: 'lead-median', label: t('statistics.median'), value: medianText(leads.value.rows.map((row) => row.minutes)) },
]);
</script>

<template>
  <div class="app-statistic-page">
    <Message v-if="unavailable" severity="warn" data-testid="history-unavailable">
      {{ t('statistics.historyUnavailable') }}
    </Message>

    <StatisticSection :title="t('statistics.unlockCurve.title')" :info="curveHints" test-id="section-unlock-curve">
      <TimeLineChart
        v-if="curveSeries.length > 0"
        :series="curveSeries"
        :y-label="t('statistics.unlockedCount')"
        :description="t('statistics.unlockCurve.title')"
      />
      <p v-else class="app-muted">{{ t('statistics.noData') }}</p>
    </StatisticSection>

    <div class="app-statistic-columns">
      <StatisticSection
        :title="t('statistics.waits.title')"
        :info="t('statistics.waits.hint')"
        test-id="section-wait-times"
      >
        <template v-if="waits">
          <StatisticFacts :facts="waitFacts" />
          <BarChart
            v-if="hasValues(waitBars)"
            :bars="waitBars"
            color="unlocks"
            :x-label="t('statistics.waits.axis')"
            :y-label="t('statistics.slotCount')"
          />
          <DataTable
            :value="waitRows"
            data-key="slotId"
            size="small"
            striped-rows
            removable-sort
            paginator
            :rows="10"
            :always-show-paginator="false"
            data-testid="wait-times"
          >
            <Column field="name" :header="t('slot.columns.name')" sortable />
            <Column field="discordName" :header="t('slot.columns.discord')" sortable />
            <Column field="minutes" :header="t('statistics.waits.column')" sortable>
              <template #body="{ data }">
                {{ formatLongDuration(data.minutes) }}
                <span v-if="data.stillLocked" class="app-muted">({{ t('statistics.waits.stillLockedShort') }})</span>
                <span v-else-if="data.estimated" class="app-muted">({{ t('statistics.estimated') }})</span>
              </template>
            </Column>
          </DataTable>
        </template>
        <p v-else class="app-muted">{{ t('statistics.noStart') }}</p>
      </StatisticSection>

      <StatisticSection
        :title="t('statistics.reactions.title')"
        :info="t('statistics.reactions.hint')"
        test-id="section-reactions"
      >
        <StatisticFacts :facts="reactionFacts" />
        <BarChart
          v-if="hasValues(reactionBars)"
          :bars="reactionBars"
          color="checks"
          :x-label="t('statistics.reactions.axis')"
          :y-label="t('statistics.slotCount')"
        />
        <h3>{{ t('statistics.reactions.withoutChecks') }}</h3>
        <DataTable
          :value="idle"
          data-key="slotId"
          size="small"
          striped-rows
          removable-sort
          paginator
          :rows="10"
          :always-show-paginator="false"
          data-testid="unlocked-without-checks"
        >
          <template #empty>{{ t('statistics.reactions.allStarted') }}</template>
          <Column field="name" :header="t('slot.columns.name')" sortable />
          <Column field="discordName" :header="t('slot.columns.discord')" sortable />
          <Column field="minutes" :header="t('statistics.reactions.since')" sortable>
            <template #body="{ data }">{{ formatLongDuration(data.minutes) }}</template>
          </Column>
        </DataTable>
      </StatisticSection>
    </div>

    <StatisticSection
      v-if="leads.pairsWithLaterItems > 0"
      :title="t('statistics.leads.title')"
      :info="t('statistics.leads.hint')"
      test-id="section-leads"
    >
      <StatisticFacts :facts="leadFacts" />
      <div class="app-statistic-columns">
        <BarChart
          v-if="hasValues(leadBars)"
          :bars="leadBars"
          color="series-2"
          :x-label="t('statistics.leads.axis')"
          :y-label="t('statistics.slotCount')"
        />
        <DataTable
          :value="leads.rows"
          size="small"
          striped-rows
          removable-sort
          paginator
          :rows="10"
          :always-show-paginator="false"
          data-testid="lead-times"
        >
          <template #empty>{{ t('statistics.leads.noTimes') }}</template>
          <Column field="name" :header="t('slot.columns.name')" sortable />
          <Column field="firstSenderName" :header="t('statistics.leads.firstSender')" sortable />
          <Column field="laterSenderName" :header="t('statistics.leads.laterSender')" sortable />
          <Column field="minutes" :header="t('statistics.leads.column')" sortable>
            <template #body="{ data }">{{ formatLongDuration(data.minutes) }}</template>
          </Column>
        </DataTable>
      </div>
    </StatisticSection>
  </div>
</template>

<style scoped>
h3 {
  margin: 0.5rem 0 0;
  font-size: 1rem;
}
</style>
