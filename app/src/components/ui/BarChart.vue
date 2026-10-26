<script setup lang="ts">
import { computed } from 'vue';

import { barRects, type ChartBar, type ChartColor } from '@/domain/charts';

const props = defineProps<{ bars: ChartBar[]; color: ChartColor; xLabel: string; yLabel: string }>();

const WIDTH = 360;
const HEIGHT = 160;
const MARGIN = { top: 16, right: 8, bottom: 36, left: 8 };

const rects = computed(() =>
  barRects(props.bars, WIDTH - MARGIN.left - MARGIN.right, HEIGHT - MARGIN.top - MARGIN.bottom),
);
const description = computed(
  () => `${props.yLabel} / ${props.xLabel}: ${props.bars.map((bar) => `${bar.label}: ${bar.value}`).join(', ')}`,
);
</script>

<template>
  <svg
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    role="img"
    :aria-label="description"
    class="bar-chart"
    data-testid="bar-chart"
  >
    <g :transform="`translate(${MARGIN.left} ${MARGIN.top})`">
      <line
        :x1="0"
        :x2="WIDTH - MARGIN.left - MARGIN.right"
        :y1="HEIGHT - MARGIN.top - MARGIN.bottom"
        :y2="HEIGHT - MARGIN.top - MARGIN.bottom"
        class="bar-axis"
      />
      <g v-for="rect in rects" :key="rect.label">
        <rect :x="rect.x" :y="rect.y" :width="rect.width" :height="rect.height" rx="2" :class="`chart-${props.color}`">
          <title>{{ props.xLabel }} {{ rect.label }}: {{ rect.value }} {{ props.yLabel }}</title>
        </rect>
        <text :x="rect.x + rect.width / 2" :y="rect.y - 4" text-anchor="middle" class="bar-value">
          {{ rect.value }}
        </text>
        <text
          :x="rect.x + rect.width / 2"
          :y="HEIGHT - MARGIN.top - MARGIN.bottom + 14"
          text-anchor="middle"
          class="bar-label"
        >
          {{ rect.label }}
        </text>
      </g>
      <text
        :x="(WIDTH - MARGIN.left - MARGIN.right) / 2"
        :y="HEIGHT - MARGIN.top - 4"
        text-anchor="middle"
        class="bar-axis-label"
      >
        {{ props.xLabel }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.bar-chart {
  width: 100%;
  max-width: 32rem;
  height: auto;
}

.bar-axis {
  stroke: var(--p-content-border-color);
}

.bar-value,
.bar-label {
  fill: var(--p-text-color);
  font-size: 0.6875rem;
}

.bar-value {
  font-weight: 700;
}

.bar-axis-label {
  fill: var(--p-text-muted-color);
  font-size: 0.6875rem;
}
</style>
