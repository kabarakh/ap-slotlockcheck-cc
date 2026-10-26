<script setup lang="ts">
import { onUnmounted } from 'vue';

import SphereLocationsDrawer from '@/components/spheres/SphereLocationsDrawer.vue';
import SphereOverviewPanel from '@/components/spheres/SphereOverviewPanel.vue';

import { useSphereLocationsStore } from '@/stores/sphere-locations';

const sphereLocations = useSphereLocationsStore();

onUnmounted(() => sphereLocations.close());
</script>

<template>
  <SphereOverviewPanel />
  <SphereLocationsDrawer />
</template>
