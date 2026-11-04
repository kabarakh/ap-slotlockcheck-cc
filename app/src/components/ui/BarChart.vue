<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';

import { useElementWidth } from './use-element-width';
import { barRects, type ChartBar, type ChartColor } from '@/domain/charts';

const props = defineProps<{ bars: ChartBar[]; color: ChartColor; xLabel: string; yLabel: string }>();

const MAX_WIDTH = 520;
const HEIGHT = 180;
const MARGIN = { top: 18, right: 4, bottom: 40, left: 4 };

const container = useTemplateRef<HTMLElement>('container');
const measured = useElementWidth(container, 360);
const width = computed(() => Math.min(MAX_WIDTH, measured.value));
const plotWidth = computed(() => width.value - MARGIN.left - MARGIN.right);
const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
const rects = computed(() => barRects(props.bars, plotWidth.value, plotHeight));
const description = computed(
  () => `${props.yLabel} / ${props.xLabel}: ${props.bars.map((bar) => `${bar.label}: ${bar.value}`).join(', ')}`,
);
</script>

<template>
  <div ref="container" class="bar-chart-container">
    <svg
      :width="width"
      :height="HEIGHT"
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      role="img"
      :aria-label="description"
      class="bar-chart"
      data-testid="bar-chart"
    >
      <g :transform="`translate(${MARGIN.left} ${MARGIN.top})`">
        <line :x1="0" :x2="plotWidth" :y1="plotHeight" :y2="plotHeight" class="bar-axis" />
        <g v-for="rect in rects" :key="rect.label">
          <rect
            :x="rect.x"
            :y="rect.y"
            :width="rect.width"
            :height="rect.height"
            rx="3"
            :class="`chart-${props.color}`"
          >
            <title>{{ props.xLabel }} {{ rect.label }}: {{ rect.value }} {{ props.yLabel }}</title>
          </rect>
          <text
            v-if="rect.value > 0"
            :x="rect.x + rect.width / 2"
            :y="rect.y - 5"
            text-anchor="middle"
            class="bar-value"
          >
            {{ rect.value }}
          </text>
          <text :x="rect.x + rect.width / 2" :y="plotHeight + 16" text-anchor="middle" class="bar-label">
            {{ rect.label }}
          </text>
        </g>
        <text :x="plotWidth / 2" :y="plotHeight + 34" text-anchor="middle" class="bar-axis-label">
          {{ props.xLabel }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.bar-chart-container {
  width: 100%;
  min-width: 0;
}

.bar-chart {
  display: block;
}

.bar-axis {
  stroke: var(--p-content-border-color);
}

.bar-value,
.bar-label {
  fill: var(--p-text-color);
  font-size: 12px;
}

.bar-value {
  font-weight: 600;
}

.bar-axis-label {
  fill: var(--p-text-muted-color);
  font-size: 12px;
}
</style>
