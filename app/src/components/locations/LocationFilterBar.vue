<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputNumber from 'primevue/inputnumber';
import MultiSelect from 'primevue/multiselect';
import Select from 'primevue/select';
import Slider from 'primevue/slider';

import type { LocationSlotScope } from '@/api/types';
import { ITEM_TYPES } from '@/domain/item-type';
import { useAuthStore } from '@/stores/auth';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useLocationsStore } from '@/stores/locations';
import { useSphereOverviewStore } from '@/stores/sphere-overview';

const locations = useLocationsStore();
const { filters, isAdminView, sphereBounds } = storeToRefs(locations);
const sphereStore = useSphereOverviewStore();
const { excludeGoaled } = storeToRefs(sphereStore);
const { sortedSlots } = storeToRefs(useCurrentRoomStore());
const { isLoggedIn } = storeToRefs(useAuthStore());
const { t } = useI18n();

const scopeOptions = computed(() =>
  (['all', 'mine', 'selected'] as LocationSlotScope[])
    .filter((scope) => scope !== 'mine' || isLoggedIn.value)
    .map((value) => ({ value, label: t(`locations.filters.scope.${value}`) })),
);
const slotOptions = computed(() =>
  sortedSlots.value.map((slot) => ({ value: slot.id, label: `#${slot.position} ${slot.name}` })),
);
const itemTypeOptions = computed(() => ITEM_TYPES.map((value) => ({ value, label: t(`itemTypes.${value}`) })));

const range = computed<[number, number]>({
  get: () => filters.value.sphereRange ?? sphereBounds.value,
  set: (value) => {
    filters.value.sphereRange = [Math.min(...value), Math.max(...value)];
  },
});
const fromSphere = computed({
  get: () => range.value[0],
  set: (value: number | null) => {
    range.value = [value ?? sphereBounds.value[0], range.value[1]];
  },
});
const toSphere = computed({
  get: () => range.value[1],
  set: (value: number | null) => {
    range.value = [range.value[0], value ?? sphereBounds.value[1]];
  },
});

const excludeGoaledModel = computed({
  get: () => excludeGoaled.value,
  set: (value: boolean) => {
    excludeGoaled.value = value;
  },
});

const apply = async () => {
  await sphereStore.fetch();
  await locations.applyFilters();
};
</script>

<template>
  <form class="location-filters" @submit.prevent="apply()">
    <div class="app-toolbar">
      <Select
        v-model="filters.slots"
        :options="scopeOptions"
        option-label="label"
        option-value="value"
        size="small"
        data-testid="location-scope"
      />
      <MultiSelect
        v-if="filters.slots === 'selected'"
        v-model="filters.slotIds"
        :options="slotOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('locations.filters.slots')"
        filter
        size="small"
        display="chip"
        data-testid="location-slots"
      />
      <MultiSelect
        v-if="isAdminView"
        v-model="filters.receiverSlotIds"
        :options="slotOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('locations.filters.receivers')"
        filter
        size="small"
        display="chip"
        data-testid="location-receivers"
      />
      <MultiSelect
        v-if="isAdminView"
        v-model="filters.itemTypes"
        :options="itemTypeOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('locations.filters.itemTypes')"
        size="small"
        display="chip"
        data-testid="location-item-types"
      />
      <label class="app-toolbar">
        <Checkbox v-model="excludeGoaledModel" binary />
        {{ t('spheres.excludeGoaled') }}
      </label>
    </div>
    <div class="app-toolbar sphere-range">
      <span>{{ t('locations.filters.spheres') }}</span>
      <InputNumber
        v-model="fromSphere"
        :min="sphereBounds[0]"
        :max="sphereBounds[1]"
        size="small"
        input-class="sphere-input"
        data-testid="sphere-from"
      />
      <Slider v-model="range" range :min="sphereBounds[0]" :max="sphereBounds[1]" class="sphere-slider" />
      <InputNumber
        v-model="toSphere"
        :min="sphereBounds[0]"
        :max="sphereBounds[1]"
        size="small"
        input-class="sphere-input"
        data-testid="sphere-to"
      />
      <Button type="submit" :label="t('locations.filters.apply')" size="small" data-testid="apply-filters" />
      <Button :label="t('filters.reset')" size="small" text @click="locations.resetFilters()" />
    </div>
  </form>
</template>

<style scoped>
.location-filters {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sphere-slider {
  width: 12rem;
}

:deep(.sphere-input) {
  width: 4.5rem;
}
</style>
