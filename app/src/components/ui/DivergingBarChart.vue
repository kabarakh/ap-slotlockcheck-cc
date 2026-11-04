<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';

import { useElementWidth } from './use-element-width';
import { divergingBars, type ChartRow } from '@/domain/charts';

const props = defineProps<{ rows: ChartRow[]; seriesLabels: Record<string, string>; xLabel: string }>();

const MAX_WIDTH = 720;
const BAR_HEIGHT = 10;
const LABEL_WIDTH = 140;
const MARGIN = { top: 8, right: 16, bottom: 40, left: 8 };

const container = useTemplateRef<HTMLElement>('container');
const measured = useElementWidth(container, 480);
const width = computed(() => Math.min(MAX_WIDTH, measured.value));
const chartWidth = computed(() => width.value - MARGIN.left - MARGIN.right - LABEL_WIDTH);
const rowHeight = computed(() => Math.max(2, ...props.rows.map((row) => row.values.length)) * BAR_HEIGHT * 1.25);
const layout = computed(() => divergingBars(props.rows, chartWidth.value, rowHeight.value));
const chartHeight = computed(() => props.rows.length * rowHeight.value);
const height = computed(() => chartHeight.value + MARGIN.top + MARGIN.bottom);
const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
const description = computed(
  () =>
    `${props.xLabel}: ${props.rows
      .map(
        (row) =>
          `${row.label} ${row.values.map((entry) => `${props.seriesLabels[entry.key]} ${signed(entry.value)}`).join(' ')}`,
      )
      .join(', ')}`,
);
</script>

<template>
  <div ref="container" class="diverging-container">
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      :aria-label="description"
      class="diverging-bar-chart"
      data-testid="diverging-bar-chart"
    >
      <g :transform="`translate(${MARGIN.left} ${MARGIN.top})`">
        <text
          v-for="row in layout.rowCenters"
          :key="row.key"
          :x="LABEL_WIDTH - 8"
          :y="row.y"
          text-anchor="end"
          dominant-baseline="central"
          class="diverging-label"
        >
          {{ row.label.length > 20 ? `${row.label.slice(0, 19)}…` : row.label }}
          <title>{{ row.label }}</title>
        </text>
        <g :transform="`translate(${LABEL_WIDTH} 0)`">
          <rect
            v-for="rect in layout.rects"
            :key="`${rect.rowKey}-${rect.key}`"
            :x="rect.x"
            :y="rect.y"
            :width="rect.width"
            :height="rect.height"
            rx="2"
            :class="[`chart-${rect.color}`, { 'chart-muted': rect.muted }]"
          >
            <title>{{ props.seriesLabels[rect.key] }}: {{ signed(rect.value) }}</title>
          </rect>
          <line :x1="layout.zeroX" :x2="layout.zeroX" :y1="0" :y2="chartHeight" class="diverging-zero" />
          <line :x1="0" :x2="chartWidth" :y1="chartHeight" :y2="chartHeight" class="diverging-axis" />
          <text :x="0" :y="chartHeight + 16" text-anchor="start" class="diverging-tick">
            {{ signed(-layout.limit) }}
          </text>
          <text :x="layout.zeroX" :y="chartHeight + 16" text-anchor="middle" class="diverging-tick">0</text>
          <text :x="chartWidth" :y="chartHeight + 16" text-anchor="end" class="diverging-tick">
            {{ signed(layout.limit) }}
          </text>
          <text :x="chartWidth / 2" :y="chartHeight + 34" text-anchor="middle" class="diverging-axis-label">
            {{ props.xLabel }}
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.diverging-container {
  width: 100%;
  min-width: 0;
}

.diverging-bar-chart {
  display: block;
}

.diverging-zero {
  stroke: var(--p-text-muted-color);
}

.diverging-axis {
  stroke: var(--p-content-border-color);
}

.diverging-label,
.diverging-tick {
  fill: var(--p-text-color);
  font-size: 12px;
}

.diverging-axis-label {
  fill: var(--p-text-muted-color);
  font-size: 12px;
}
</style>
