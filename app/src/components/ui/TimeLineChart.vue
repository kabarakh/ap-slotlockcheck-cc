<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { useElementWidth } from './use-element-width';
import { lineChartLayout, timeTickFormat, type LineSeries } from '@/domain/statistics-charts';

const props = withDefaults(
  defineProps<{ series: LineSeries[]; yLabel: string; description: string; height?: number; integer?: boolean }>(),
  { height: 220, integer: true },
);
const { d } = useI18n();

const MARGIN = { top: 24, right: 16, bottom: 28, left: 44 };

const container = useTemplateRef<HTMLElement>('container');
const width = useElementWidth(container, 640);
const plotWidth = computed(() => width.value - MARGIN.left - MARGIN.right);
const plotHeight = computed(() => props.height - MARGIN.top - MARGIN.bottom);
const layout = computed(() => lineChartLayout(props.series, plotWidth.value, plotHeight.value));
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
  <div ref="container" class="time-line-chart">
    <svg
      :width="width"
      :height="props.height"
      :viewBox="`0 0 ${width} ${props.height}`"
      role="img"
      :aria-label="props.description"
      data-testid="time-line-chart"
    >
      <g :transform="`translate(${MARGIN.left} ${MARGIN.top})`">
        <g v-for="tick in yTicks" :key="`y-${tick.value}`">
          <line :x1="0" :x2="plotWidth" :y1="tick.position" :y2="tick.position" class="grid" />
          <text :x="-8" :y="tick.position" text-anchor="end" dominant-baseline="central" class="tick">
            {{ tick.value }}
          </text>
        </g>
        <text
          v-for="tick in layout.xTicks"
          :key="`x-${tick.value}`"
          :x="tick.position"
          :y="plotHeight + 18"
          text-anchor="middle"
          class="tick"
        >
          {{ tickLabel(tick.value) }}
        </text>
        <line :x1="0" :x2="plotWidth" :y1="plotHeight" :y2="plotHeight" class="axis" />
        <text :x="-MARGIN.left" :y="-12" class="axis-label">{{ props.yLabel }}</text>
        <template v-for="path in layout.paths" :key="path.key">
          <path v-if="path.area" :d="path.area" class="area" :style="{ fill: `var(--app-chart-${path.color})` }" />
          <path
            :d="path.path"
            class="series"
            :class="{ dashed: path.dashed }"
            :style="{ stroke: `var(--app-chart-${path.color})` }"
            :data-series="path.key"
          >
            <title>{{ path.label }}</title>
          </path>
        </template>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.time-line-chart {
  width: 100%;
  min-width: 0;
}

.time-line-chart svg {
  display: block;
}

.grid {
  stroke: var(--p-content-border-color);
  stroke-width: 1;
  opacity: 0.6;
}

.axis {
  stroke: var(--p-content-border-color);
}

.tick {
  fill: var(--p-text-muted-color);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.axis-label {
  fill: var(--p-text-muted-color);
  font-size: 12px;
}

.series {
  fill: none;
  stroke-width: 1.75;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.series.dashed {
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
}

.area {
  opacity: 0.12;
}
</style>
