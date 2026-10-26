<script setup lang="ts">
import { computed } from 'vue';

import { donutSegments, type ChartPart } from '@/domain/charts';

const props = withDefaults(defineProps<{ parts: ChartPart[]; center?: string; size?: number }>(), {
  center: '',
  size: 96,
});

const radius = computed(() => props.size / 2);
const segments = computed(() => donutSegments(props.parts, radius.value, props.size * 0.16));
const total = computed(() => props.parts.reduce((sum, part) => sum + part.value, 0));
const description = computed(() => props.parts.map((part) => `${part.label}: ${part.value}`).join(', '));
</script>

<template>
  <svg
    :viewBox="`${-radius} ${-radius} ${props.size} ${props.size}`"
    :width="props.size"
    :height="props.size"
    role="img"
    :aria-label="description"
    class="donut-chart"
    data-testid="donut-chart"
  >
    <circle v-if="total === 0" :r="radius - props.size * 0.08" class="chart-empty" :stroke-width="props.size * 0.16" />
    <path v-for="segment in segments" :key="segment.key" :d="segment.path" :class="`chart-${segment.color}`">
      <title>{{ segment.label }}: {{ segment.value }}</title>
    </path>
    <text v-if="props.center" class="donut-center" text-anchor="middle" dominant-baseline="central">
      {{ props.center }}
    </text>
  </svg>
</template>

<style scoped>
.donut-chart {
  flex-shrink: 0;
}

.chart-empty {
  fill: none;
  stroke: var(--app-chart-rest);
}

.donut-center {
  fill: var(--p-text-color);
  font-size: 0.8125rem;
  font-weight: 700;
}
</style>
