<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import AutoComplete, { type AutoCompleteCompleteEvent } from 'primevue/autocomplete';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import type { ReleaseMode } from '@/api/types';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useServerAdminStore } from '@/stores/server-admin';
import ServerConfirmDialog from './ServerConfirmDialog.vue';

const serverAdmin = useServerAdminStore();
const { itemDraft, releaseDraft, itemNames, commandSlotId, loggedIn, jobRunning, busy } = storeToRefs(serverAdmin);
const { playableSlots } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

const slotOptions = computed(() =>
  playableSlots.value.map((slot) => ({ value: slot.id, label: `#${slot.position} ${slot.name}` })),
);
const modeOptions = computed(() =>
  (['all', 'filler', 'marked'] as ReleaseMode[]).map((value) => ({ value, label: t(`server.releaseModes.${value}`) })),
);
const suggestions = ref<string[]>([]);
const search = (event: AutoCompleteCompleteEvent) => {
  const needle = event.query.toLocaleLowerCase();
  suggestions.value = itemNames.value.filter((name) => name.toLocaleLowerCase().includes(needle)).slice(0, 50);
};
const itemSlot = computed({
  get: () => itemDraft.value.slotId,
  set: (value: number | null) => void serverAdmin.loadItemNames(value),
});
const disabled = computed(() => !loggedIn.value || jobRunning.value || busy.value);
</script>

<template>
  <section class="app-form server-commands">
    <h3>{{ t('server.releaseSpheres') }}</h3>
    <form class="app-toolbar" @submit.prevent="serverAdmin.askReleaseSpheres()">
      <label class="app-toolbar">
        {{ t('cleanup.from') }}
        <InputNumber v-model="releaseDraft.fromSphere" :min="0" size="small" input-class="sphere-input" />
      </label>
      <label class="app-toolbar">
        {{ t('cleanup.to') }}
        <InputNumber
          v-model="releaseDraft.toSphere"
          :min="0"
          size="small"
          input-class="sphere-input"
          data-testid="release-to"
        />
      </label>
      <Select
        v-model="releaseDraft.mode"
        :options="modeOptions"
        option-label="label"
        option-value="value"
        size="small"
        data-testid="release-mode"
      />
      <Button
        type="submit"
        :label="t('server.releaseSpheres')"
        severity="danger"
        size="small"
        :disabled="disabled"
        data-testid="release-spheres"
      />
    </form>

    <h3>{{ t('server.slotCommands') }}</h3>
    <div class="app-toolbar">
      <Select
        v-model="commandSlotId"
        :options="slotOptions"
        option-label="label"
        option-value="value"
        filter
        :placeholder="t('locations.filters.slots')"
        size="small"
        data-testid="command-slot"
      />
      <Button
        :label="t('server.release')"
        severity="danger"
        size="small"
        :disabled="disabled || commandSlotId === null"
        data-testid="release-slot"
        @click="serverAdmin.askSlotCommand('release')"
      />
      <Button
        :label="t('server.collect')"
        severity="warn"
        size="small"
        :disabled="disabled || commandSlotId === null"
        data-testid="collect-slot"
        @click="serverAdmin.askSlotCommand('collect')"
      />
    </div>

    <h3>{{ t('server.sendItem') }}</h3>
    <form class="app-toolbar" @submit.prevent="serverAdmin.sendItem()">
      <Select
        v-model="itemSlot"
        :options="slotOptions"
        option-label="label"
        option-value="value"
        filter
        :placeholder="t('locations.filters.slots')"
        size="small"
        data-testid="item-slot"
      />
      <AutoComplete
        v-model="itemDraft.itemName"
        :suggestions="suggestions"
        :placeholder="t('server.itemName')"
        size="small"
        data-testid="item-name"
        @complete="search"
      />
      <InputNumber v-model="itemDraft.amount" :min="1" :max="1000" size="small" input-class="sphere-input" />
      <Button
        type="submit"
        :label="t('server.send')"
        size="small"
        :disabled="disabled || itemDraft.slotId === null || itemDraft.itemName.trim().length === 0"
        data-testid="send-item"
      />
    </form>
    <ServerConfirmDialog />
  </section>
</template>

<style scoped>
.server-commands {
  margin-top: 1.5rem;
}

:deep(.sphere-input) {
  width: 4.5rem;
}
</style>
