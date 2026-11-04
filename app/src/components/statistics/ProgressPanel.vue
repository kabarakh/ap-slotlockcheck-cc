<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';

import DateTimeText from '@/components/ui/DateTimeText.vue';
import GanttChart from '@/components/ui/GanttChart.vue';
import HeatmapChart from '@/components/ui/HeatmapChart.vue';
import StatisticFacts from '@/components/ui/StatisticFacts.vue';
import StatisticSection from '@/components/ui/StatisticSection.vue';
import TimeLineChart from '@/components/ui/TimeLineChart.vue';

import { formatLongDuration } from '@/domain/duration';
import {
  activityHeatmap,
  checksForecast,
  concurrentPlayers,
  goalTimeline,
  slotForecasts,
} from '@/domain/progress-statistics';
import type { GanttRow, LineSeries } from '@/domain/statistics-charts';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useRoomHistoryStore } from '@/stores/room-history';

const historyStore = useRoomHistoryStore();
const { history, loading, unavailable } = storeToRefs(historyStore);
const { slots, hasSlotLock } = storeToRefs(useCurrentRoomStore());
const { t, d, locale } = useI18n();

onMounted(() => historyStore.open());
onUnmounted(() => historyStore.close());

const iso = (time: number | null) => (time === null ? null : new Date(time).toISOString());
const dateText = (time: number | null) =>
  time === null ? t('statistics.forecast.none') : d(new Date(time), 'dateTime');

const forecast = computed(() => (history.value ? checksForecast(history.value, slots.value) : null));
const forecastSeries = computed<LineSeries[]>(() =>
  forecast.value === null
    ? []
    : [
        { key: 'checks', label: t('statistics.checks'), color: 'checks', points: forecast.value.points },
        {
          key: 'forecast',
          label: t('statistics.forecast.series'),
          color: 'checks',
          points: forecast.value.forecast,
          dashed: true,
        },
      ],
);
const forecastFacts = computed(() =>
  forecast.value === null || history.value === null
    ? []
    : [
        {
          key: 'checks-per-hour',
          label: t('statistics.forecast.rate', { hours: history.value.rateWindowHours }),
          value: String(forecast.value.checksPerHour),
        },
        {
          key: 'expected-end',
          label: t('statistics.forecast.expectedEnd'),
          value: dateText(forecast.value.expectedEnd),
        },
      ],
);
const slotRows = computed(() => (history.value ? slotForecasts(history.value, slots.value) : []));

const weekdays = computed(() => {
  const format = new Intl.DateTimeFormat(locale.value, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(2026, 10, 2 + index)));
});
const hours = Array.from({ length: 24 }, (_, hour) => String(hour));
const heatmap = computed(() => (history.value ? activityHeatmap(history.value) : null));

const concurrent = computed(() => (history.value ? concurrentPlayers(history.value) : null));
const concurrentSeries = computed<LineSeries[]>(() =>
  concurrent.value === null
    ? []
    : [
        {
          key: 'players',
          label: t('statistics.concurrent.series'),
          color: 'series-4',
          points: concurrent.value.points,
          step: true,
        },
      ],
);
const concurrentFacts = computed(() =>
  concurrent.value?.peak
    ? [
        {
          key: 'peak',
          label: t('statistics.concurrent.peak'),
          value: `${concurrent.value.peak.value} (${dateText(concurrent.value.peak.time)})`,
        },
      ]
    : [],
);

const start = computed(() => (history.value?.startedAt ? new Date(history.value.startedAt).getTime() : null));
const now = computed(() => (history.value ? new Date(history.value.calculatedAt).getTime() : Date.now()));
const timeline = computed(() => goalTimeline(slots.value, start.value));
const ganttRows = computed<GanttRow[]>(() =>
  timeline.value.map((row) => {
    const end = row.goalAt ?? now.value;
    const lockedTo = row.playFrom ?? now.value;
    return {
      key: String(row.slotId),
      label: row.discordName ? `${row.name} (${row.discordName})` : row.name,
      goalAt: row.goalAt,
      segments: [
        ...(row.lockedFrom !== null && lockedTo > row.lockedFrom
          ? [{ kind: 'locked' as const, from: row.lockedFrom, to: lockedTo }]
          : []),
        ...(row.playFrom !== null && end > row.playFrom
          ? [{ kind: 'playing' as const, from: row.playFrom, to: end }]
          : []),
      ],
    };
  }),
);
const goalRows = computed(() =>
  timeline.value.filter((row) => row.goalAt !== null).map((row, index) => ({ ...row, rank: index + 1 })),
);
</script>

<template>
  <div class="app-statistic-page">
    <ProgressSpinner v-if="loading && !history" />
    <Message v-else-if="unavailable" severity="warn" data-testid="history-unavailable">
      {{ t('statistics.historyUnavailable') }}
    </Message>

    <template v-if="history && forecast">
      <StatisticSection
        :title="t('statistics.forecast.title')"
        :hints="[t('statistics.forecast.hint', { hours: history.rateWindowHours })]"
        test-id="section-forecast"
      >
        <StatisticFacts :facts="forecastFacts" />
        <TimeLineChart
          :series="forecastSeries"
          :y-label="t('statistics.checks')"
          :description="t('statistics.forecast.title')"
        />
        <DataTable
          :value="slotRows"
          data-key="slotId"
          size="small"
          striped-rows
          removable-sort
          paginator
          :rows="10"
          :always-show-paginator="false"
          data-testid="slot-forecasts"
        >
          <Column field="name" :header="t('slot.columns.name')" sortable />
          <Column field="discordName" :header="t('slot.columns.discord')" sortable />
          <Column field="game" :header="t('slot.columns.game')" sortable />
          <Column field="openChecks" :header="t('statistics.openChecks')" sortable />
          <Column
            field="recentChecks"
            :header="t('statistics.forecast.recentChecks', { hours: history.rateWindowHours })"
            sortable
          />
          <Column field="expectedEnd" :header="t('statistics.forecast.slotEnd')" sortable>
            <template #body="{ data }">
              <DateTimeText v-if="data.expectedEnd !== null" :value="iso(data.expectedEnd)" />
              <span v-else class="app-muted">{{ t('statistics.forecast.none') }}</span>
            </template>
          </Column>
        </DataTable>
      </StatisticSection>

      <StatisticSection
        :title="t('statistics.activity.title')"
        :hints="[t('statistics.activity.hint')]"
        test-id="section-activity"
      >
        <HeatmapChart
          v-if="heatmap"
          :row-labels="weekdays"
          :column-labels="hours"
          :values="heatmap.values"
          color="series-4"
          :cell-size="18"
          :label-width="40"
          :show-values="false"
          :column-title="t('statistics.activity.hours')"
          :description="t('statistics.activity.title')"
        />
      </StatisticSection>

      <StatisticSection
        :title="t('statistics.concurrent.title')"
        :hints="[t('statistics.concurrent.hint')]"
        test-id="section-concurrent"
      >
        <StatisticFacts :facts="concurrentFacts" />
        <TimeLineChart
          :series="concurrentSeries"
          :y-label="t('statistics.playerCount')"
          :description="t('statistics.concurrent.title')"
          :height="160"
        />
      </StatisticSection>
    </template>

    <StatisticSection
      :title="t('statistics.goals.title')"
      :hints="[hasSlotLock ? t('statistics.goals.hint') : t('statistics.goals.hintWithoutLocks')]"
      test-id="section-goals"
    >
      <ul class="app-statistic-legend">
        <li v-if="hasSlotLock"><span class="chart-legend chart-rest" />{{ t('statistics.goals.locked') }}</li>
        <li><span class="chart-legend chart-checks" />{{ t('statistics.goals.playing') }}</li>
        <li><span class="chart-legend chart-goal" />{{ t('statistics.goals.goal') }}</li>
      </ul>
      <GanttChart
        v-if="ganttRows.some((row) => row.segments.length > 0)"
        :rows="ganttRows"
        :description="t('statistics.goals.title')"
      />
      <p v-else class="app-muted">{{ t('statistics.noStart') }}</p>
      <DataTable
        :value="goalRows"
        data-key="slotId"
        size="small"
        striped-rows
        removable-sort
        paginator
        :rows="10"
        :always-show-paginator="false"
        data-testid="goal-order"
      >
        <template #empty>{{ t('statistics.goals.none') }}</template>
        <Column field="rank" header="#" sortable />
        <Column field="name" :header="t('slot.columns.name')" sortable />
        <Column field="discordName" :header="t('slot.columns.discord')" sortable />
        <Column field="goalAt" :header="t('statistics.goals.goalTime')" sortable>
          <template #body="{ data }"><DateTimeText :value="iso(data.goalAt)" /></template>
        </Column>
        <Column field="minutesToGoal" :header="t('statistics.goals.duration')" sortable>
          <template #body="{ data }">
            {{ data.minutesToGoal === null ? t('common.none') : formatLongDuration(data.minutesToGoal) }}
          </template>
        </Column>
      </DataTable>
    </StatisticSection>
  </div>
</template>
