<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import type { SlotRow } from '@/api/types';
import { formatGameName } from '@/domain/game-name';
import type { InactivityLevel } from '@/domain/inactivity';
import { checksPercentage, isGoaled } from '@/domain/summary';
import CheeseStatusTag from './CheeseStatusTag.vue';
import InactivityText from './InactivityText.vue';
import LockStatusTag from './LockStatusTag.vue';
import UnlockInfo from './UnlockInfo.vue';

const props = defineProps<{
  slots: SlotRow[];
  hoursBySlotId: Map<number, number | null>;
  levelBySlotId: Map<number, InactivityLevel>;
  warningCountBySlotId: ReadonlyMap<number, number> | null;
  testId: string;
}>();
const { t } = useI18n();

const otherArchipelagoName = (slot: SlotRow): string | null =>
  slot.archipelagoName && !slot.name.includes(slot.archipelagoName) ? slot.archipelagoName : null;

const rows = computed(() =>
  props.slots.map((slot) => ({
    ...slot,
    gameName: formatGameName(slot.game),
    inactivityHours: props.hoursBySlotId.get(slot.id) ?? -1,
    warningCount: props.warningCountBySlotId?.get(slot.id) ?? 0,
  })),
);

type Row = (typeof rows.value)[number];
</script>

<template>
  <DataTable
    :value="rows"
    data-key="id"
    sort-field="position"
    :sort-order="1"
    removable-sort
    striped-rows
    size="small"
    class="slot-table"
    :data-testid="props.testId"
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
    <Column field="lockStatus" :header="t('slot.columns.lockStatus')" sortable>
      <template #body="{ data }">
        <LockStatusTag :status="(data as Row).lockStatus" />
      </template>
    </Column>
    <Column field="unlockTime" :header="t('slot.columns.unlockedBy')" sortable>
      <template #body="{ data }">
        <UnlockInfo :locks="(data as Row).locks" />
      </template>
    </Column>
    <Column field="inactivityHours" :header="t('slot.columns.inactivity')" sortable>
      <template #body="{ data }">
        <InactivityText
          :hours="props.hoursBySlotId.get((data as Row).id) ?? null"
          :level="props.levelBySlotId.get((data as Row).id) ?? 'none'"
        />
      </template>
    </Column>
    <Column field="checksDone" :header="t('slot.columns.checks')" sortable>
      <template #body="{ data }">
        <span class="nowrap">{{ (data as Row).checksDone }} / {{ (data as Row).checksTotal }}</span>
        <span class="app-muted nowrap check-percentage">
          {{
            t('statistics.percentage', { value: checksPercentage((data as Row).checksDone, (data as Row).checksTotal) })
          }}
        </span>
      </template>
    </Column>
    <Column field="completionStatus" :header="t('slot.columns.cheeseStatus')" sortable>
      <template #body="{ data }">
        <span class="status-stack">
          <CheeseStatusTag
            v-if="(data as Row).completionStatus !== 'incomplete'"
            kind="completion"
            :value="(data as Row).completionStatus"
          />
          <CheeseStatusTag v-if="!isGoaled(data as Row)" kind="progression" :value="(data as Row).progressionStatus" />
        </span>
      </template>
    </Column>
    <Column field="notes" :header="t('slot.columns.notes')">
      <template #body="{ data }">
        <span class="notes">{{ (data as Row).notes }}</span>
      </template>
    </Column>
    <Column field="unlocksSent" :header="t('slot.columns.unlocksSent')" sortable />
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

.check-percentage {
  margin-left: 0.35rem;
}

.notes {
  display: block;
  max-width: 14rem;
  overflow-wrap: anywhere;
}
</style>
