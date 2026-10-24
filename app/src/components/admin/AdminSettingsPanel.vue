<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import { useAdminStore } from '@/stores/admin';
import { useCurrentRoomStore } from '@/stores/current-room';

const admin = useAdminStore();
const { settingsDraft, busy } = storeToRefs(admin);
const { slotLockSlots, room } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();
</script>

<template>
  <form class="app-form" @submit.prevent="admin.saveSettings()">
    <label class="app-field">
      {{ t('admin.roomTitle') }}
      <InputText v-model="settingsDraft.title" />
    </label>
    <label class="app-field">
      {{ t('admin.yellowLimit') }}
      <InputNumber v-model="settingsDraft.yellowLimitHours" :min="0" suffix=" h" />
    </label>
    <label class="app-field">
      {{ t('admin.redLimit') }}
      <InputNumber v-model="settingsDraft.redLimitHours" :min="0" suffix=" h" />
    </label>
    <p class="app-muted">
      {{ room?.limitsOverridden ? t('admin.limitsOverridden') : t('admin.limitsFromCheese') }}
    </p>
    <fieldset class="app-field">
      <legend>{{ t('admin.slotLockSlots') }}</legend>
      <label v-for="slot in slotLockSlots" :key="slot.id" class="app-toolbar">
        <Checkbox v-model="settingsDraft.slotLockPositions" :value="slot.position" />
        #{{ slot.position }} {{ slot.name }}
      </label>
      <span class="app-muted">{{ t('admin.slotLockSlotsHint') }}</span>
    </fieldset>
    <div class="app-toolbar">
      <Button type="submit" :label="t('common.save')" :loading="busy" />
      <Button :label="t('common.reset')" text @click="admin.resetSettingsDraft()" />
      <Button
        v-if="room?.limitsOverridden"
        :label="t('admin.useCheeseLimits')"
        severity="secondary"
        text
        @click="admin.useCheeseLimits()"
      />
    </div>
  </form>
</template>

<style scoped>
fieldset {
  border: none;
  padding: 0;
}
</style>
