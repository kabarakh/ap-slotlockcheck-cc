<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Column from 'primevue/column';
import DataTable from 'primevue/datatable';

import BarChart from '@/components/ui/BarChart.vue';
import DivergingBarChart from '@/components/ui/DivergingBarChart.vue';
import DonutChart from '@/components/ui/DonutChart.vue';
import HeatmapChart from '@/components/ui/HeatmapChart.vue';
import SlotNameList from '@/components/ui/SlotNameList.vue';
import StatisticFacts from '@/components/ui/StatisticFacts.vue';
import StatisticSection from '@/components/ui/StatisticSection.vue';

import type { ChartColor, ChartRow } from '@/domain/charts';
import {
  unlocksSentBalance,
  unlocksSentShares,
  type PlayerSummary,
  type UnlocksSentExpectation,
} from '@/domain/summary';
import { gameBalance, treeMetrics, unlockMatrix } from '@/domain/unlock-statistics';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useStatisticsStore } from '@/stores/statistics';

const { playerSummaries, unlockForest } = storeToRefs(useStatisticsStore());
const { slots } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

const percentage = (value: number) => t('statistics.percentage', { value });
const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

const unlocksSentParts = computed(() => unlocksSentShares(playerSummaries.value, t('statistics.otherPlayers')));

const balance = computed(() => unlocksSentBalance(playerSummaries.value));
const hasLaterItems = computed(() => balance.value.some((player) => player.laterUnlockItemCount > 0));
type ExpectationKey = 'bySlots' | 'bySlotsWithLater' | 'byLocations' | 'byLocationsWithLater';
interface BalanceSeries {
  key: ExpectationKey;
  label: string;
  color: ChartColor;
  muted: boolean;
}
const balanceSeries = computed(() =>
  (
    [
      { key: 'bySlots', label: t('statistics.balance.bySlots'), color: 'unlocks', muted: false },
      { key: 'bySlotsWithLater', label: t('statistics.balance.bySlotsWithLater'), color: 'unlocks', muted: true },
      { key: 'byLocations', label: t('statistics.balance.byLocations'), color: 'series-2', muted: false },
      {
        key: 'byLocationsWithLater',
        label: t('statistics.balance.byLocationsWithLater'),
        color: 'series-2',
        muted: true,
      },
    ] satisfies BalanceSeries[]
  ).filter((series) => hasLaterItems.value || !series.muted),
);
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
  t('statistics.balance.expectation', { expected: expectation.expected, deviation: signed(expectation.deviation) });
const balanceHints = computed(() => [
  t('statistics.balance.hint'),
  ...(hasLaterItems.value ? [t('statistics.balance.laterItemsHint')] : []),
]);

const games = computed(() => gameBalance(slots.value));
const gameRows = computed<ChartRow[]>(() =>
  games.value.map((game) => ({
    key: game.game,
    label: game.game,
    values: [{ key: 'byLocations', value: game.byLocations.deviation, color: 'series-2' }],
  })),
);

const matrix = computed(() => unlockMatrix(slots.value));
const matrixFacts = computed(() => [
  { key: 'self-unlocks', label: t('statistics.matrix.selfUnlocks'), value: String(matrix.value.selfUnlocks) },
  { key: 'mutual-pairs', label: t('statistics.matrix.mutualPairs'), value: String(matrix.value.mutualPairs.length) },
]);

const tree = computed(() => treeMetrics(unlockForest.value));
const treeFacts = computed(() => [
  { key: 'max-depth', label: t('statistics.tree.maxDepth'), value: String(tree.value.maxDepth) },
  {
    key: 'largest-subtree',
    label: t('statistics.tree.largestSubtree'),
    value: tree.value.largestSubtrees[0]
      ? `${tree.value.largestSubtrees[0].name} (${tree.value.largestSubtrees[0].descendants})`
      : t('common.none'),
  },
]);
const depthBars = computed(() =>
  tree.value.depthDistribution.map((entry) => ({ label: String(entry.depth), value: entry.slotCount })),
);
</script>

<template>
  <div class="app-statistic-page">
    <div class="app-statistic-columns">
      <StatisticSection
        :title="t('statistics.unlocksSentByPlayer')"
        :hints="[t('statistics.unlocksSentHint')]"
        test-id="section-unlocks-sent"
      >
        <div class="share-chart" data-testid="unlocks-sent-shares">
          <DonutChart :parts="unlocksSentParts" :size="160" />
          <ul class="share-legend">
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
          paginator
          :rows="10"
          :always-show-paginator="false"
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
      </StatisticSection>

      <StatisticSection
        :title="t('statistics.matrix.title')"
        :hints="[t('statistics.matrix.hint')]"
        test-id="section-matrix"
      >
        <StatisticFacts :facts="matrixFacts" />
        <p v-if="matrix.mutualPairs.length > 0" class="app-muted mutual">
          {{ matrix.mutualPairs.map((pair) => pair.join(' ⇄ ')).join(', ') }}
        </p>
        <HeatmapChart
          v-if="matrix.senders.length > 0"
          :row-labels="matrix.senders.map((player) => player.name)"
          :column-labels="matrix.receivers.map((player) => player.name)"
          :values="matrix.values"
          color="unlocks"
          :row-title="t('statistics.matrix.senders')"
          :column-title="t('statistics.matrix.receivers')"
          :description="t('statistics.matrix.title')"
        />
        <p v-else class="app-muted">{{ t('statistics.noData') }}</p>
      </StatisticSection>
    </div>

    <StatisticSection :title="t('statistics.balance.title')" :hints="balanceHints" test-id="section-balance">
      <ul class="app-statistic-legend">
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
        paginator
        :rows="10"
        :always-show-paginator="false"
        data-testid="unlocks-sent-balance"
      >
        <Column field="name" :header="t('players.columns.name')" sortable />
        <Column field="unlocksSentCount" :header="t('statistics.unlocksSentCount')" sortable />
        <Column v-if="hasLaterItems" field="laterUnlockItemCount" :header="t('statistics.balance.laterItems')" sortable>
          <template #body="{ data }">
            <SlotNameList :count="data.laterUnlockItemCount" :names="data.laterUnlockNames" />
          </template>
        </Column>
        <Column
          v-if="hasLaterItems"
          field="foundUnlockItemCount"
          :header="t('statistics.balance.foundItems')"
          sortable
        />
        <Column field="bySlots.share" :header="t('statistics.balance.slotShare')" sortable>
          <template #body="{ data }">{{ percentage(data.bySlots.share) }}</template>
        </Column>
        <Column field="bySlots.deviation" :header="t('statistics.balance.bySlots')" sortable>
          <template #body="{ data }">
            <div>{{ expectationText(data.bySlots) }}</div>
            <div v-if="hasLaterItems" class="app-muted">{{ expectationText(data.bySlotsWithLater) }}</div>
          </template>
        </Column>
        <Column field="byLocations.share" :header="t('statistics.balance.locationShare')" sortable>
          <template #body="{ data }">{{ percentage(data.byLocations.share) }}</template>
        </Column>
        <Column field="byLocations.deviation" :header="t('statistics.balance.byLocations')" sortable>
          <template #body="{ data }">
            <div>{{ expectationText(data.byLocations) }}</div>
            <div v-if="hasLaterItems" class="app-muted">{{ expectationText(data.byLocationsWithLater) }}</div>
          </template>
        </Column>
      </DataTable>
    </StatisticSection>

    <div class="app-statistic-columns">
      <StatisticSection
        :title="t('statistics.games.title')"
        :hints="[t('statistics.games.hint')]"
        test-id="section-game-balance"
      >
        <DivergingBarChart
          :rows="gameRows"
          :series-labels="{ byLocations: t('statistics.balance.byLocations') }"
          :x-label="t('statistics.balance.deviation')"
        />
        <DataTable
          :value="games"
          data-key="game"
          size="small"
          striped-rows
          removable-sort
          paginator
          :rows="10"
          :always-show-paginator="false"
          data-testid="game-balance"
        >
          <Column field="game" :header="t('slot.columns.game')" sortable />
          <Column field="slotCount" :header="t('statistics.games.slots')" sortable />
          <Column field="byLocations.share" :header="t('statistics.balance.locationShare')" sortable>
            <template #body="{ data }">{{ percentage(data.byLocations.share) }}</template>
          </Column>
          <Column field="unlocksSentCount" :header="t('statistics.games.unlocks')" sortable />
          <Column field="byLocations.deviation" :header="t('statistics.balance.byLocations')" sortable>
            <template #body="{ data }">{{ expectationText(data.byLocations) }}</template>
          </Column>
        </DataTable>
      </StatisticSection>

      <StatisticSection :title="t('statistics.tree.title')" :hints="[t('statistics.tree.hint')]" test-id="section-tree">
        <StatisticFacts :facts="treeFacts" />
        <div v-if="tree.longestChain.length > 0">
          <div class="app-muted">{{ t('statistics.tree.longestChain') }}</div>
          <div data-testid="longest-chain">{{ tree.longestChain.join(' → ') }}</div>
        </div>
        <BarChart
          :bars="depthBars"
          color="unlocks"
          :x-label="t('statistics.tree.depth')"
          :y-label="t('statistics.tree.slotCount')"
        />
        <DataTable :value="tree.largestSubtrees" data-key="id" size="small" striped-rows data-testid="largest-subtrees">
          <Column field="name" :header="t('slot.columns.name')" />
          <Column field="discordName" :header="t('slot.columns.discord')" />
          <Column field="descendants" :header="t('statistics.tree.descendants')" />
        </DataTable>
      </StatisticSection>
    </div>
  </div>
</template>

<style scoped>
.share-chart {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.share-legend {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
}

.mutual {
  margin: 0;
  font-size: 0.875rem;
}
</style>
