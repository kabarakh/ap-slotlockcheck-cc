<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputNumber from 'primevue/inputnumber';

import { useAdminStore } from '@/stores/admin';

const admin = useAdminStore();
const { sphereSettingsDraft, busy } = storeToRefs(admin);
const { t } = useI18n();
</script>

<template>
  <form class="app-form" @submit.prevent="admin.saveSphereSettings()">
    <h2>{{ t('sphereSettings.title') }}</h2>
    <label class="app-field">
      {{ t('sphereSettings.offset') }}
      <InputNumber v-model="sphereSettingsDraft.sphereOffset" :min="0" :max="1000" data-testid="sphere-offset" />
      <span class="app-muted">{{ t('sphereSettings.offsetHint') }}</span>
    </label>
    <label class="app-toolbar">
      <Checkbox v-model="sphereSettingsDraft.visitorsSeeLocations" binary data-testid="visitors-see-locations" />
      {{ t('sphereSettings.visitors') }}
    </label>
    <label class="app-toolbar">
      <Checkbox v-model="sphereSettingsDraft.playersMarkFiller" binary data-testid="players-mark-filler" />
      {{ t('sphereSettings.playersMarkFiller') }}
    </label>
    <div class="app-toolbar">
      <Button type="submit" :label="t('common.save')" :loading="busy" data-testid="save-sphere-settings" />
      <Button :label="t('common.reset')" text @click="admin.resetSphereSettingsDraft()" />
    </div>
  </form>
</template>
