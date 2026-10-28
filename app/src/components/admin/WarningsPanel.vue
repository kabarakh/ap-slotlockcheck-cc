<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';

import WarningDialog from './WarningDialog.vue';
import DateTimeText from '@/components/ui/DateTimeText.vue';

import type { Warning } from '@/api/types';
import { useWarningsStore } from '@/stores/warnings';

const warningsStore = useWarningsStore();
const { warnings } = storeToRefs(warningsStore);
const { t } = useI18n();

onMounted(() => warningsStore.fetch());
</script>

<template>
  <section>
    <div class="app-toolbar">
      <Button
        :label="t('warnings.add')"
        icon="pi pi-plus"
        size="small"
        data-testid="add-warning"
        @click="warningsStore.startDraft()"
      />
    </div>
    <DataTable
      :value="warnings"
      data-key="id"
      size="small"
      striped-rows
      sort-field="date"
      :sort-order="-1"
      data-testid="warnings-table"
    >
      <template #empty>{{ t('warnings.empty') }}</template>
      <Column field="date" :header="t('warnings.columns.date')" sortable>
        <template #body="{ data }"><DateTimeText :value="(data as Warning).date" /></template>
      </Column>
      <Column field="slotName" :header="t('warnings.columns.slot')" sortable />
      <Column field="adminName" :header="t('warnings.columns.admin')" sortable />
      <Column field="text" :header="t('warnings.columns.text')" />
      <Column>
        <template #body="{ data }">
          <Button
            icon="pi pi-trash"
            severity="danger"
            size="small"
            text
            :aria-label="t('warnings.delete')"
            @click="warningsStore.remove((data as Warning).id)"
          />
        </template>
      </Column>
    </DataTable>
    <WarningDialog />
  </section>
</template>
