<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Column from 'primevue/column';
import DataTable from 'primevue/datatable';

import type { SphereItemTypes, SphereRow } from '@/api/types';

const props = defineProps<{ spheres: SphereRow[]; itemTypes: SphereItemTypes[] | null }>();
const { t } = useI18n();

const rows = computed(() => {
  const types = new Map((props.itemTypes ?? []).map((entry) => [entry.sphere, entry]));
  return props.spheres.map((sphere) => {
    const entry = types.get(sphere.sphere);
    return {
      ...sphere,
      progression: entry?.progression ?? 0,
      filler: entry ? entry.useful + entry.normal + entry.trap : 0,
      useful: entry?.useful ?? 0,
      normal: entry?.normal ?? 0,
      trap: entry?.trap ?? 0,
    };
  });
});

const totals = computed(() =>
  rows.value.reduce(
    (sum, row) => ({
      open: sum.open + row.open,
      found: sum.found + row.found,
      total: sum.total + row.total,
      progression: sum.progression + row.progression,
      filler: sum.filler + row.filler,
    }),
    { open: 0, found: 0, total: 0, progression: 0, filler: 0 },
  ),
);
</script>

<template>
  <DataTable :value="rows" data-key="sphere" size="small" striped-rows data-testid="sphere-table">
    <template #empty>{{ t('spheres.empty') }}</template>
    <Column field="sphere" :header="t('spheres.columns.sphere')">
      <template #body="{ data }">
        <slot name="sphere" :sphere="(data as SphereRow).sphere">{{ (data as SphereRow).sphere }}</slot>
      </template>
    </Column>
    <Column field="open" :header="t('spheres.columns.open')" />
    <Column field="found" :header="t('spheres.columns.found')" />
    <Column field="total" :header="t('spheres.columns.total')" />
    <template v-if="props.itemTypes">
      <Column field="progression" :header="t('itemTypes.progression')" />
      <Column field="filler" :header="t('spheres.columns.filler')">
        <template #body="{ data }">
          {{ data.filler }}
          <span class="app-muted">
            ({{
              t('spheres.fillerParts', {
                useful: data.useful,
                normal: data.normal,
                trap: data.trap,
              })
            }})
          </span>
        </template>
      </Column>
    </template>
    <template #footer>
      <span data-testid="sphere-totals">
        {{ t('spheres.totals', totals) }}
        <template v-if="props.itemTypes">{{ t('spheres.totalTypes', totals) }}</template>
      </span>
    </template>
  </DataTable>
</template>
