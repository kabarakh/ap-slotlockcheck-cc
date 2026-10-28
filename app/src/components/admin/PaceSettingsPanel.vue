<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';

import { useAdminStore } from '@/stores/admin';

const admin = useAdminStore();
const { paceSettingsDraft, busy } = storeToRefs(admin);
const { t } = useI18n();
</script>

<template>
  <form class="app-form" @submit.prevent="admin.savePaceSettings()">
    <h2>{{ t('paceSettings.title') }}</h2>
    <label class="app-field">
      {{ t('paceSettings.breakLimit') }}
      <InputNumber
        v-model="paceSettingsDraft.paceBreakLimitMinutes"
        :min="10"
        :max="1440"
        :allow-empty="false"
        data-testid="pace-break-limit"
      />
      <span class="app-muted">{{ t('paceSettings.breakLimitHint') }}</span>
    </label>
    <label class="app-field">
      {{ t('paceSettings.bulkLimit') }}
      <InputNumber
        v-model="paceSettingsDraft.paceBulkLimitChecks"
        :min="1"
        :max="10000"
        :allow-empty="false"
        data-testid="pace-bulk-limit"
      />
      <span class="app-muted">{{ t('paceSettings.bulkLimitHint') }}</span>
    </label>
    <div class="app-toolbar">
      <Button type="submit" :label="t('common.save')" :loading="busy" data-testid="save-pace-settings" />
      <Button :label="t('common.reset')" text @click="admin.resetPaceSettingsDraft()" />
    </div>
  </form>
</template>
