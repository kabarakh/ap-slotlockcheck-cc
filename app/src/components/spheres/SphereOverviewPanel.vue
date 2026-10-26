<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Checkbox from 'primevue/checkbox';
import ProgressSpinner from 'primevue/progressspinner';

import SphereOverviewTable from '@/components/ui/SphereOverviewTable.vue';

import { useCurrentRoomStore } from '@/stores/current-room';
import { useSphereOverviewStore } from '@/stores/sphere-overview';

const sphereStore = useSphereOverviewStore();
const { overview, excludeGoaled, loading } = storeToRefs(sphereStore);
const { isHelper } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

const excludeGoaledModel = computed({
  get: () => excludeGoaled.value,
  set: (value: boolean) => void sphereStore.setExcludeGoaled(value),
});

onMounted(() => sphereStore.fetch());
</script>

<template>
  <section class="sphere-overview">
    <div class="app-toolbar">
      <h2>{{ t('spheres.title') }}</h2>
      <span class="app-spacer" />
      <label class="app-toolbar">
        <Checkbox v-model="excludeGoaledModel" binary data-testid="exclude-goaled" />
        {{ t('spheres.excludeGoaled') }}
      </label>
    </div>
    <ProgressSpinner v-if="loading && !overview" />
    <template v-else-if="overview">
      <p class="app-muted" data-testid="sphere-summary">
        {{
          overview.lowestOpenSphere === null
            ? t('spheres.allFound')
            : t('spheres.lowestOpen', { sphere: overview.lowestOpenSphere })
        }}
        <template v-if="!isHelper">{{ t('spheres.visibleUpTo', { sphere: overview.visibleMaxSphere }) }}</template>
      </p>
      <SphereOverviewTable :spheres="overview.spheres" :item-types="overview.itemTypes" />
    </template>
  </section>
</template>

<style scoped>
.sphere-overview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sphere-overview h2 {
  margin: 0;
}
</style>
