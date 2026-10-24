<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import { useStatisticsStore } from '@/stores/statistics';

const { globalStatistics } = storeToRefs(useStatisticsStore());
const { t } = useI18n();
</script>

<template>
  <section class="app-main statistics">
    <div class="app-stat-grid" data-testid="statistics">
      <div class="app-stat">
        <div class="app-muted">{{ t('statistics.unlocked') }}</div>
        <div class="app-stat-value">{{ globalStatistics.unlockedCount }} / {{ globalStatistics.lockableCount }}</div>
        <div>{{ t('statistics.percentage', { value: globalStatistics.unlockedPercentage }) }}</div>
      </div>
      <div class="app-stat">
        <div class="app-muted">{{ t('statistics.goaled') }}</div>
        <div class="app-stat-value">{{ globalStatistics.goaledCount }} / {{ globalStatistics.slotCount }}</div>
        <div>{{ t('statistics.percentage', { value: globalStatistics.goaledPercentage }) }}</div>
      </div>
      <div class="app-stat">
        <div class="app-muted">{{ t('statistics.allChecks') }}</div>
        <div class="app-stat-value">{{ globalStatistics.allChecksCount }} / {{ globalStatistics.slotCount }}</div>
        <div>{{ t('statistics.percentage', { value: globalStatistics.allChecksPercentage }) }}</div>
      </div>
    </div>
    <h2>{{ t('statistics.playersByLocked') }}</h2>
    <DataTable :value="globalStatistics.playersByLockedCount" size="small" striped-rows>
      <Column field="lockedCount" :header="t('statistics.lockedCount')" />
      <Column field="playerCount" :header="t('statistics.playerCount')" />
    </DataTable>
  </section>
</template>

<style scoped>
.statistics {
  padding: 0;
  margin: 0;
}
</style>
