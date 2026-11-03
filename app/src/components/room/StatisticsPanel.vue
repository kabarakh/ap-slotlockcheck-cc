<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Column from 'primevue/column';
import DataTable from 'primevue/datatable';

import BarChart from '@/components/ui/BarChart.vue';
import DivergingBarChart from '@/components/ui/DivergingBarChart.vue';
import DonutChart from '@/components/ui/DonutChart.vue';
import SlotNameList from '@/components/ui/SlotNameList.vue';

import type { ChartColor, ChartPart, ChartRow } from '@/domain/charts';
import {
  unlocksSentBalance,
  unlocksSentShares,
  type PlayerSummary,
  type UnlocksSentExpectation,
} from '@/domain/summary';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useStatisticsStore } from '@/stores/statistics';

interface StatisticCard {
  key: string;
  title: string;
  value: string;
  center: string;
  parts: ChartPart[];
  legend: boolean;
}

const { globalStatistics, playerSummaries } = storeToRefs(useStatisticsStore());
const { hasSlotLock } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

const percentage = (value: number) => t('statistics.percentage', { value });

const cards = computed<StatisticCard[]>(() => {
  const stats = globalStatistics.value;
  const cardList: StatisticCard[] = [
    {
      key: 'unlocked',
      title: t('statistics.unlocked'),
      value: `${stats.unlockedCount} / ${stats.lockableCount}`,
      center: percentage(stats.unlockedPercentage),
      legend: false,
      parts: [
        { key: 'unlocked', label: t('statistics.parts.unlocked'), value: stats.unlockedCount, color: 'unlocks' },
        {
          key: 'locked',
          label: t('statistics.parts.locked'),
          value: stats.lockableCount - stats.unlockedCount,
          color: 'rest',
        },
      ],
    },
    {
      key: 'goaled',
      title: t('statistics.goaled'),
      value: `${stats.goaledCount} / ${stats.slotCount}`,
      center: percentage(stats.goaledPercentage),
      legend: false,
      parts: [
        { key: 'goaled', label: t('statistics.parts.goaled'), value: stats.goaledCount, color: 'goal' },
        {
          key: 'open',
          label: t('statistics.parts.notGoaled'),
          value: stats.slotCount - stats.goaledCount,
          color: 'rest',
        },
      ],
    },
    {
      key: 'checks',
      title: t('statistics.checks'),
      value: `${stats.checksDone} / ${stats.checksTotal}`,
      center: percentage(stats.checksPercentage),
      legend: false,
      parts: [
        { key: 'done', label: t('statistics.parts.checksDone'), value: stats.checksDone, color: 'checks' },
        {
          key: 'open',
          label: t('statistics.parts.checksOpen'),
          value: stats.checksTotal - stats.checksDone,
          color: 'rest',
        },
      ],
    },
    {
      key: 'openChecks',
      title: t('statistics.openChecks'),
      value: String(stats.openChecksInOpenSlots + stats.openChecksInLockedSlots),
      center: '',
      legend: true,
      parts: [
        {
          key: 'openSlots',
          label: t('statistics.openChecksInOpenSlots'),
          value: stats.openChecksInOpenSlots,
          color: 'checks',
        },
        {
          key: 'lockedSlots',
          label: t('statistics.openChecksInLockedSlots'),
          value: stats.openChecksInLockedSlots,
          color: 'locked',
        },
      ],
    },
    {
      key: 'allChecks',
      title: t('statistics.allChecks'),
      value: `${stats.allChecksCount} / ${stats.slotCount}`,
      center: percentage(stats.allChecksPercentage),
      legend: false,
      parts: [
        { key: 'all', label: t('statistics.parts.allChecks'), value: stats.allChecksCount, color: 'checks' },
        {
          key: 'open',
          label: t('statistics.parts.openChecksLeft'),
          value: stats.slotCount - stats.allChecksCount,
          color: 'rest',
        },
      ],
    },
  ];
  if (hasSlotLock.value) {
    return cardList;
  }
  return cardList
    .filter((card) => card.key !== 'unlocked')
    .map((card) => ({ ...card, parts: card.parts.filter((part) => part.key !== 'lockedSlots') }));
});

const lockedBars = computed(() =>
  globalStatistics.value.playersByLockedCount.map((entry) => ({
    label: String(entry.lockedCount),
    value: entry.playerCount,
  })),
);
const unlockedBars = computed(() =>
  globalStatistics.value.playersByUnlockedCount.map((entry) => ({
    label: String(entry.slotCount),
    value: entry.playerCount,
  })),
);
const balance = computed(() => unlocksSentBalance(playerSummaries.value));
type ExpectationKey = 'bySlots' | 'bySlotsWithLater' | 'byLocations' | 'byLocationsWithLater';
const balanceSeries = computed<{ key: ExpectationKey; label: string; color: ChartColor; muted: boolean }[]>(() => [
  { key: 'bySlots', label: t('statistics.balance.bySlots'), color: 'unlocks', muted: false },
  { key: 'bySlotsWithLater', label: t('statistics.balance.bySlotsWithLater'), color: 'unlocks', muted: true },
  { key: 'byLocations', label: t('statistics.balance.byLocations'), color: 'series-2', muted: false },
  {
    key: 'byLocationsWithLater',
    label: t('statistics.balance.byLocationsWithLater'),
    color: 'series-2',
    muted: true,
  },
]);
const balanceSeriesLabels = computed(() =>
  Object.fromEntries(balanceSeries.value.map((series) => [series.key, series.label])),
);
const balanceRows = computed<ChartRow[]>(() =>
  balance.value.map((player) => ({
    key: player.key,
    label: player.name,
    values: balanceSeries.value.map((series) => ({
      key: series.key,
      value: player[series.key].deviation,
      color: series.color,
      muted: series.muted,
    })),
  })),
);
const expectationText = (expectation: UnlocksSentExpectation) =>
  t('statistics.balance.expectation', {
    expected: expectation.expected,
    deviation: expectation.deviation > 0 ? `+${expectation.deviation}` : String(expectation.deviation),
  });

const unlocksSentParts = computed(() => unlocksSentShares(playerSummaries.value, t('statistics.otherPlayers')));
</script>

<template>
  <section class="app-main statistics">
    <div class="app-stat-grid" data-testid="statistics">
      <div v-for="card in cards" :key="card.key" class="app-stat statistic" :data-testid="`statistics-${card.key}`">
        <DonutChart :parts="card.parts" :center="card.center" />
        <div>
          <div class="app-muted">{{ card.title }}</div>
          <div class="app-stat-value">{{ card.value }}</div>
          <ul v-if="card.legend" class="statistic-legend">
            <li v-for="part in card.parts" :key="part.key">
              <span class="chart-legend" :class="`chart-${part.color}`" />{{ part.label }}: {{ part.value }}
            </li>
          </ul>
        </div>
      </div>
    </div>
    <div v-if="hasSlotLock" class="distributions">
      <div>
        <h2>{{ t('statistics.playersByLocked') }}</h2>
        <BarChart
          :bars="lockedBars"
          color="locked"
          :x-label="t('statistics.lockedCount')"
          :y-label="t('statistics.playerCount')"
        />
        <DataTable :value="globalStatistics.playersByLockedCount" size="small" striped-rows>
          <Column field="lockedCount" :header="t('statistics.lockedCount')" />
          <Column field="playerCount" :header="t('statistics.playerCount')" />
        </DataTable>
      </div>
      <div>
        <h2>{{ t('statistics.playersByUnlocked') }}</h2>
        <BarChart
          :bars="unlockedBars"
          color="unlocks"
          :x-label="t('statistics.unlockedCount')"
          :y-label="t('statistics.playerCount')"
        />
        <DataTable
          :value="globalStatistics.playersByUnlockedCount"
          size="small"
          striped-rows
          data-testid="players-by-unlocked"
        >
          <Column field="slotCount" :header="t('statistics.unlockedCount')" />
          <Column field="playerCount" :header="t('statistics.playerCount')" />
        </DataTable>
      </div>
      <div>
        <h2>{{ t('statistics.unlocksSentByPlayer') }}</h2>
        <div class="statistic share-chart" data-testid="unlocks-sent-shares">
          <DonutChart :parts="unlocksSentParts" :size="160" />
          <ul class="statistic-legend">
            <li v-for="part in unlocksSentParts" :key="part.key">
              <span class="chart-legend" :class="`chart-${part.color}`" />{{ part.label }}:
              {{ percentage(part.percentage) }}
            </li>
          </ul>
        </div>
        <DataTable
          :value="playerSummaries"
          data-key="key"
          sort-field="unlocksSentCount"
          :sort-order="-1"
          removable-sort
          size="small"
          striped-rows
          data-testid="unlocks-sent-by-player"
        >
          <Column field="name" :header="t('players.columns.name')" sortable />
          <Column field="unlocksSentCount" :header="t('statistics.unlocksSentCount')" sortable>
            <template #body="{ data }">
              <SlotNameList
                :count="(data as PlayerSummary).unlocksSentCount"
                :names="(data as PlayerSummary).unlocksSentNames"
              />
            </template>
          </Column>
        </DataTable>
      </div>
    </div>
    <div v-if="hasSlotLock" class="balance">
      <h2>{{ t('statistics.balance.title') }}</h2>
      <p class="app-muted balance-hint">{{ t('statistics.balance.hint') }}</p>
      <p class="app-muted balance-hint">{{ t('statistics.balance.laterItemsHint') }}</p>
      <ul class="statistic-legend balance-legend">
        <li v-for="series in balanceSeries" :key="series.key">
          <span class="chart-legend" :class="[`chart-${series.color}`, { 'chart-muted': series.muted }]" />
          {{ series.label }}
        </li>
      </ul>
      <DivergingBarChart
        :rows="balanceRows"
        :series-labels="balanceSeriesLabels"
        :x-label="t('statistics.balance.deviation')"
      />
      <DataTable
        :value="balance"
        data-key="key"
        size="small"
        striped-rows
        removable-sort
        data-testid="unlocks-sent-balance"
      >
        <Column field="name" :header="t('players.columns.name')" sortable />
        <Column field="unlocksSentCount" :header="t('statistics.unlocksSentCount')" sortable />
        <Column field="laterUnlockItemCount" :header="t('statistics.balance.laterItems')" sortable>
          <template #body="{ data }">
            <SlotNameList :count="data.laterUnlockItemCount" :names="data.laterUnlockNames" />
          </template>
        </Column>
        <Column field="foundUnlockItemCount" :header="t('statistics.balance.foundItems')" sortable />
        <Column field="bySlots.share" :header="t('statistics.balance.slotShare')" sortable>
          <template #body="{ data }">{{ percentage(data.bySlots.share) }}</template>
        </Column>
        <Column field="bySlots.deviation" :header="t('statistics.balance.bySlots')" sortable>
          <template #body="{ data }">
            <div>{{ expectationText(data.bySlots) }}</div>
            <div class="app-muted">{{ expectationText(data.bySlotsWithLater) }}</div>
          </template>
        </Column>
        <Column field="byLocations.share" :header="t('statistics.balance.locationShare')" sortable>
          <template #body="{ data }">{{ percentage(data.byLocations.share) }}</template>
        </Column>
        <Column field="byLocations.deviation" :header="t('statistics.balance.byLocations')" sortable>
          <template #body="{ data }">
            <div>{{ expectationText(data.byLocations) }}</div>
            <div class="app-muted">{{ expectationText(data.byLocationsWithLater) }}</div>
          </template>
        </Column>
      </DataTable>
    </div>
  </section>
</template>

<style scoped>
.statistics {
  padding: 0;
  margin: 0;
}

.statistic {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.statistic-legend {
  margin: 0.25rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
}

.share-chart {
  margin-bottom: var(--app-gap);
}

.balance {
  margin-top: var(--app-gap);
}

.balance-hint {
  margin: 0 0 0.5rem;
}

.balance-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem var(--app-gap);
  margin-bottom: 0.5rem;
}

.distributions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  gap: var(--app-gap);
}
</style>
