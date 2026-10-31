<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import ProgressSpinner from 'primevue/progressspinner';

import SphereOverviewTable from '@/components/ui/SphereOverviewTable.vue';

import { isSphereDone } from '@/domain/sphere-status';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useSphereLocationsStore } from '@/stores/sphere-locations';
import { useSphereOverviewStore } from '@/stores/sphere-overview';

const sphereStore = useSphereOverviewStore();
const { overview, excludeGoaled, showDone, loading } = storeToRefs(sphereStore);
const { isHelper } = storeToRefs(useCurrentRoomStore());
const sphereLocations = useSphereLocationsStore();
const route = useRoute();
const { t } = useI18n();

const showsSphereLocations = computed(() => route.meta.sphereLocations === true);

const excludeGoaledModel = computed({
  get: () => excludeGoaled.value,
  set: (value: boolean) => void sphereStore.setExcludeGoaled(value),
});

const doneCount = computed(() => overview.value?.spheres.filter(isSphereDone).length ?? 0);

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
      <label class="app-toolbar">
        <Checkbox v-model="showDone" binary data-testid="show-done" />
        {{ t('spheres.showDone', { count: doneCount }) }}
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
      <p v-if="showsSphereLocations" class="app-muted">{{ t('control.sphereLocations.hint') }}</p>
      <SphereOverviewTable :spheres="overview.spheres" :item-types="overview.itemTypes" :show-done="showDone">
        <template v-if="showsSphereLocations" #sphere="{ sphere }">
          <Button
            :label="String(sphere)"
            link
            size="small"
            class="sphere-link"
            :data-testid="`sphere-open-${sphere}`"
            @click="sphereLocations.open(sphere)"
          />
        </template>
      </SphereOverviewTable>
    </template>
  </section>
</template>

<style scoped>
.sphere-overview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sphere-link {
  padding: 0;
}

.sphere-overview h2 {
  margin: 0;
}
</style>
