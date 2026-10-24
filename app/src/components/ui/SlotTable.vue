<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import type { SlotRow } from '@/api/types';
import type { InactivityLevel } from '@/domain/inactivity';
import { isGoaled } from '@/domain/summary';
import CheeseStatusTag from './CheeseStatusTag.vue';
import InactivityText from './InactivityText.vue';
import LockStatusTag from './LockStatusTag.vue';
import UnlockedByText from './UnlockedByText.vue';
import UnlockTimeText from './UnlockTimeText.vue';

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
    inactivityHours: props.hoursBySlotId.get(slot.id) ?? -1,
    warningCount: props.warningCountBySlotId?.get(slot.id) ?? 0,
  })),
);
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
    scrollable
    :data-testid="props.testId"
  >
    <template #empty>{{ t('slot.empty') }}</template>
    <Column field="position" :header="t('slot.columns.position')" sortable />
    <Column field="name" :header="t('slot.columns.name')" sortable>
      <template #body="{ data }">
        <span>{{ (data as SlotRow).name }}</span>
        <span v-if="otherArchipelagoName(data as SlotRow)" class="app-muted archipelago-name">
          {{ otherArchipelagoName(data as SlotRow) }}
        </span>
      </template>
    </Column>
    <Column field="discordName" :header="t('slot.columns.discord')" sortable />
    <Column field="game" :header="t('slot.columns.game')" sortable />
    <Column field="lockStatus" :header="t('slot.columns.lockStatus')" sortable>
      <template #body="{ data }">
        <LockStatusTag :status="(data as SlotRow).lockStatus" />
      </template>
    </Column>
    <Column :header="t('slot.columns.unlockedBy')">
      <template #body="{ data }">
        <UnlockedByText :locks="(data as SlotRow).locks" />
      </template>
    </Column>
    <Column field="unlockTime" :header="t('slot.columns.unlockTime')" sortable>
      <template #body="{ data }">
        <UnlockTimeText :time="(data as SlotRow).unlockTime" :source="(data as SlotRow).unlockTimeSource" />
      </template>
    </Column>
    <Column field="inactivityHours" :header="t('slot.columns.inactivity')" sortable>
      <template #body="{ data }">
        <InactivityText
          :hours="props.hoursBySlotId.get((data as SlotRow).id) ?? null"
          :level="props.levelBySlotId.get((data as SlotRow).id) ?? 'none'"
        />
      </template>
    </Column>
    <Column field="checksDone" :header="t('slot.columns.checks')" sortable>
      <template #body="{ data }">{{ (data as SlotRow).checksDone }} / {{ (data as SlotRow).checksTotal }}</template>
    </Column>
    <Column field="progressionStatus" :header="t('slot.columns.progression')" sortable>
      <template #body="{ data }">
        <span v-if="isGoaled(data as SlotRow)" class="app-muted">{{ t('common.none') }}</span>
        <CheeseStatusTag v-else kind="progression" :value="(data as SlotRow).progressionStatus" />
      </template>
    </Column>
    <Column field="completionStatus" :header="t('slot.columns.completion')" sortable>
      <template #body="{ data }">
        <CheeseStatusTag kind="completion" :value="(data as SlotRow).completionStatus" />
      </template>
    </Column>
    <Column field="availabilityStatus" :header="t('slot.columns.availability')" sortable>
      <template #body="{ data }">
        <CheeseStatusTag kind="availability" :value="(data as SlotRow).availabilityStatus" />
      </template>
    </Column>
    <Column field="notes" :header="t('slot.columns.notes')" />
    <Column field="unlocksSent" :header="t('slot.columns.unlocksSent')" sortable />
    <Column v-if="props.warningCountBySlotId" field="warningCount" :header="t('slot.columns.warnings')" sortable />
  </DataTable>
</template>

<style scoped>
.archipelago-name {
  display: block;
  font-size: 0.75rem;
}
</style>
