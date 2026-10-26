<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Select from 'primevue/select';
import Tag from 'primevue/tag';

import type { AdminRole, RoomAdmin } from '@/api/types';
import { useAdminStore } from '@/stores/admin';

const admin = useAdminStore();
const { admins, playerOptions, newAdminDiscordId, newAdminRole, busy } = storeToRefs(admin);
const { t } = useI18n();

const roleOptions = computed(() =>
  (['admin', 'helper'] as AdminRole[]).map((value) => ({ value, label: t(`admins.roles.${value}`) })),
);
</script>

<template>
  <section>
    <DataTable :value="admins" data-key="userId" size="small" striped-rows data-testid="admins-table">
      <Column field="name" :header="t('admins.columns.name')" />
      <Column :header="t('admins.columns.role')">
        <template #body="{ data }">
          <Tag v-if="(data as RoomAdmin).isOwner" :value="t('admins.owner')" severity="info" />
          <Tag v-else :value="t(`admins.roles.${(data as RoomAdmin).role}`)" severity="secondary" />
        </template>
      </Column>
      <Column>
        <template #body="{ data }">
          <Button
            v-if="!(data as RoomAdmin).isOwner"
            :label="t('admins.remove')"
            icon="pi pi-trash"
            size="small"
            severity="danger"
            text
            :disabled="busy"
            @click="admin.removeAdmin((data as RoomAdmin).userId)"
          />
        </template>
      </Column>
    </DataTable>
    <form class="app-toolbar add-admin" @submit.prevent="admin.addAdmin()">
      <Select
        v-model="newAdminDiscordId"
        :options="playerOptions"
        option-label="name"
        option-value="discordId"
        filter
        :placeholder="t('admins.selectPlayer')"
      />
      <Select
        v-model="newAdminRole"
        :options="roleOptions"
        option-label="label"
        option-value="value"
        data-testid="new-admin-role"
      />
      <Button type="submit" :label="t('admins.add')" :disabled="!newAdminDiscordId" :loading="busy" />
    </form>
  </section>
</template>

<style scoped>
.add-admin {
  margin-top: 1rem;
}
</style>
