<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';

import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';

import StatisticsFilterBar from '@/components/statistics/StatisticsFilterBar.vue';
import DateTimeText from '@/components/ui/DateTimeText.vue';
import HeatmapChart from '@/components/ui/HeatmapChart.vue';
import SlotNameList from '@/components/ui/SlotNameList.vue';
import StatisticFacts from '@/components/ui/StatisticFacts.vue';
import StatisticSection from '@/components/ui/StatisticSection.vue';
import TimeLineChart from '@/components/ui/TimeLineChart.vue';

import { blockerStatistics, progressionStatistics, sphereProgressCurve } from '@/domain/dependency-statistics';
import type { LineSeries } from '@/domain/statistics-charts';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useDependenciesStore } from '@/stores/dependencies';
import { useStatisticsFilterStore } from '@/stores/statistics-filter';

const store = useDependenciesStore();
const { dependencies, loading } = storeToRefs(store);
const { slots, hasSlotLock } = storeToRefs(useCurrentRoomStore());
const filter = useStatisticsFilterStore();
const { t } = useI18n();

onMounted(() => store.open());
onUnmounted(() => store.close());

const blockers = computed(() =>
  dependencies.value
    ? blockerStatistics(
        dependencies.value.blockers.filter(
          (blocker) => filter.includes(blocker.lockedSlotId) || filter.includes(blocker.finderSlotId),
        ),
        slots.value,
      )
    : null,
);
const blockerFacts = computed(() =>
  blockers.value === null
    ? []
    : [
        {
          key: 'blocked-slots',
          label: t('dependencies.blockers.blockedSlots'),
          value: String(blockers.value.slots.length),
        },
        {
          key: 'blocking-players',
          label: t('dependencies.blockers.players'),
          value: String(blockers.value.players.length),
        },
        {
          key: 'single-copy',
          label: t('dependencies.blockers.singleCopy'),
          value: String(blockers.value.slots.filter((slot) => slot.copyCount === 1).length),
        },
      ],
);

const progression = computed(() =>
  dependencies.value
    ? progressionStatistics(
        dependencies.value.progressionFlow.filter(
          (row) => filter.includes(row.finderSlotId) || filter.includes(row.receiverSlotId),
        ),
        slots.value,
      )
    : null,
);

const sphereCurve = computed(() => (dependencies.value ? sphereProgressCurve(dependencies.value) : null));
const sphereSeries = computed<LineSeries[]>(() =>
  sphereCurve.value === null
    ? []
    : [
        {
          key: 'lowest-open-sphere',
          label: t('dependencies.spheres.series'),
          color: 'series-1',
          points: sphereCurve.value.points,
          filled: true,
        },
      ],
);
const sphereFacts = computed(() => [
  {
    key: 'lowest-open-sphere',
    label: t('dependencies.spheres.lowestOpen'),
    value:
      sphereCurve.value?.lowestOpenSphere === null || sphereCurve.value === null
        ? t('dependencies.spheres.allDone')
        : String(sphereCurve.value.lowestOpenSphere),
  },
]);
</script>

<template>
  <div class="app-statistic-page">
    <StatisticsFilterBar />
    <ProgressSpinner v-if="loading && !dependencies" />
    <template v-if="dependencies">
      <StatisticSection
        v-if="hasSlotLock && blockers"
        :title="t('dependencies.blockers.title')"
        :info="t('dependencies.blockers.hint')"
        test-id="section-blockers"
      >
        <Message v-if="blockers.details.length === 0" severity="success" :closable="false">
          {{ t('dependencies.blockers.none') }}
        </Message>
        <template v-else>
          <StatisticFacts :facts="blockerFacts" />
          <div class="app-statistic-columns">
            <div>
              <h3>{{ t('dependencies.blockers.byPlayer') }}</h3>
              <DataTable
                :value="blockers.players"
                data-key="key"
                size="small"
                striped-rows
                removable-sort
                paginator
                :rows="10"
                :always-show-paginator="false"
                data-testid="blocking-players"
              >
                <Column field="name" :header="t('players.columns.name')" sortable />
                <Column field="blockedSlotCount" :header="t('dependencies.blockers.blockedSlots')" sortable>
                  <template #body="{ data }">
                    <SlotNameList :count="data.blockedSlotCount" :names="data.blockedNames" />
                  </template>
                </Column>
                <Column field="itemCount" :header="t('dependencies.blockers.items')" sortable />
                <Column field="lowestSphere" :header="t('dependencies.blockers.lowestSphere')" sortable />
              </DataTable>
            </div>
            <div>
              <h3>{{ t('dependencies.blockers.bySlot') }}</h3>
              <DataTable
                :value="blockers.slots"
                data-key="slotId"
                size="small"
                striped-rows
                removable-sort
                paginator
                :rows="10"
                :always-show-paginator="false"
                data-testid="blocked-slots"
              >
                <Column field="name" :header="t('slot.columns.name')" sortable />
                <Column field="discordName" :header="t('slot.columns.discord')" sortable />
                <Column field="copyCount" :header="t('dependencies.blockers.copies')" sortable>
                  <template #body="{ data }">
                    <SlotNameList :count="data.copyCount" :names="data.finderNames" />
                  </template>
                </Column>
                <Column field="lowestSphere" :header="t('dependencies.blockers.lowestSphere')" sortable />
              </DataTable>
            </div>
          </div>
          <h3>{{ t('dependencies.blockers.details') }}</h3>
          <DataTable
            :value="blockers.details"
            data-key="key"
            size="small"
            striped-rows
            removable-sort
            paginator
            :rows="10"
            :always-show-paginator="false"
            data-testid="blocker-details"
          >
            <Column field="lockedName" :header="t('dependencies.blockers.lockedSlot')" sortable />
            <Column field="finderName" :header="t('dependencies.blockers.finderSlot')" sortable>
              <template #body="{ data }">
                {{ data.finderName }} <span class="app-muted">{{ data.finderPlayer }}</span>
              </template>
            </Column>
            <Column field="locationName" :header="t('locations.columns.location')" sortable />
            <Column field="sphere" :header="t('locations.columns.sphere')" sortable />
          </DataTable>
        </template>
      </StatisticSection>

      <StatisticSection
        v-if="progression"
        :title="t('dependencies.progression.title')"
        :info="t('dependencies.progression.hint')"
        test-id="section-progression"
      >
        <div class="app-statistic-columns">
          <DataTable
            :value="progression.players"
            data-key="key"
            size="small"
            striped-rows
            removable-sort
            paginator
            :rows="10"
            :always-show-paginator="false"
            data-testid="progression-players"
          >
            <Column field="name" :header="t('players.columns.name')" sortable />
            <Column field="openForOthers" :header="t('dependencies.progression.openForOthers')" sortable />
            <Column field="totalForOthers" :header="t('dependencies.progression.totalForOthers')" sortable />
            <Column field="waitingOnOthers" :header="t('dependencies.progression.waitingOnOthers')" sortable />
          </DataTable>
          <HeatmapChart
            v-if="progression.finders.length > 0"
            :row-labels="progression.finders.map((player) => player.name)"
            :column-labels="progression.receivers.map((player) => player.name)"
            :values="progression.openValues"
            color="series-2"
            :row-title="t('dependencies.progression.finders')"
            :column-title="t('dependencies.progression.receivers')"
            :description="t('dependencies.progression.title')"
          />
          <p v-else class="app-muted">{{ t('dependencies.progression.noneOpen') }}</p>
        </div>
      </StatisticSection>

      <StatisticSection
        v-if="sphereCurve"
        :title="t('dependencies.spheres.title')"
        :info="t('dependencies.spheres.hint')"
        test-id="section-sphere-progress"
      >
        <StatisticFacts :facts="sphereFacts" />
        <TimeLineChart
          :series="sphereSeries"
          :y-label="t('locations.columns.sphere')"
          :description="t('dependencies.spheres.title')"
        />
        <DataTable
          :value="dependencies.spheres"
          data-key="sphere"
          size="small"
          striped-rows
          paginator
          :rows="10"
          :always-show-paginator="false"
          data-testid="sphere-progress"
        >
          <Column field="sphere" :header="t('locations.columns.sphere')" />
          <Column field="locationCount" :header="t('dependencies.spheres.locations')" />
          <Column field="doneAt" :header="t('dependencies.spheres.doneAt')">
            <template #body="{ data }"><DateTimeText :value="data.doneAt" /></template>
          </Column>
        </DataTable>
      </StatisticSection>
    </template>
  </div>
</template>

<style scoped>
h3 {
  margin: 0.25rem 0;
  font-size: 1rem;
}
</style>
