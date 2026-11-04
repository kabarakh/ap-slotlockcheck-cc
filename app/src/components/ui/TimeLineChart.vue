<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { lineChartLayout, timeTickFormat, type LineSeries } from '@/domain/statistics-charts';

const props = withDefaults(
  defineProps<{ series: LineSeries[]; yLabel: string; description: string; height?: number; integer?: boolean }>(),
  { height: 200, integer: true },
);
const { d } = useI18n();

const WIDTH = 640;
const MARGIN = { top: 24, right: 16, bottom: 28, left: 48 };

const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
const plotHeight = computed(() => props.height - MARGIN.top - MARGIN.bottom);
const layout = computed(() => lineChartLayout(props.series, plotWidth, plotHeight.value));
const yTicks = computed(() =>
  props.integer ? layout.value.yTicks.filter((tick) => Number.isInteger(tick.value)) : layout.value.yTicks,
);
const tickLabel = (time: number): string => {
  const value = new Date(time);
  const format = timeTickFormat(layout.value.xTicks, time);
  return format === 'dayTime' ? `${d(value, 'day')} ${d(value, 'time')}` : d(value, format);
};
</script>

<template>
  <div class="time-line-chart">
    <svg
      :viewBox="`0 0 ${WIDTH} ${props.height}`"
      role="img"
      :aria-label="props.description"
      data-testid="time-line-chart"
    >
      <g :transform="`translate(${MARGIN.left} ${MARGIN.top})`">
        <g v-for="tick in yTicks" :key="`y-${tick.value}`">
          <line :x1="0" :x2="plotWidth" :y1="tick.position" :y2="tick.position" class="grid" />
          <text :x="-6" :y="tick.position" text-anchor="end" dominant-baseline="central" class="tick">
            {{ tick.value }}
          </text>
        </g>
        <g v-for="tick in layout.xTicks" :key="`x-${tick.value}`">
          <line :x1="tick.position" :x2="tick.position" :y1="plotHeight" :y2="plotHeight + 4" class="axis" />
          <text :x="tick.position" :y="plotHeight + 16" text-anchor="middle" class="tick">
            {{ tickLabel(tick.value) }}
          </text>
        </g>
        <line :x1="0" :x2="plotWidth" :y1="plotHeight" :y2="plotHeight" class="axis" />
        <text :x="-MARGIN.left + 4" :y="-12" class="axis-label">{{ props.yLabel }}</text>
        <path
          v-for="path in layout.paths"
          :key="path.key"
          :d="path.path"
          class="series"
          :class="{ dashed: path.dashed }"
          :style="{ stroke: `var(--app-chart-${path.color})` }"
          :data-series="path.key"
        >
          <title>{{ path.label }}</title>
        </path>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.time-line-chart svg {
  width: 100%;
  height: auto;
}

.grid {
  stroke: var(--p-content-border-color);
  stroke-dasharray: 2 3;
}

.axis {
  stroke: var(--p-content-border-color);
}

.tick,
.axis-label {
  fill: var(--p-text-muted-color);
  font-size: 0.6875rem;
}

.series {
  fill: none;
  stroke-width: 2;
}

.series.dashed {
  stroke-dasharray: 6 4;
}
</style>
