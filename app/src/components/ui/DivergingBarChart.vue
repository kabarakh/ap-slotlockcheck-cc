<script setup lang="ts">
import { computed } from 'vue';

import { divergingBars, type DivergingBarRow } from '@/domain/charts';

const props = defineProps<{ rows: DivergingBarRow[]; seriesLabels: Record<string, string>; xLabel: string }>();

const WIDTH = 480;
const ROW_HEIGHT = 32;
const LABEL_WIDTH = 120;
const MARGIN = { top: 8, right: 16, bottom: 36, left: 8 };

const chartWidth = WIDTH - MARGIN.left - MARGIN.right - LABEL_WIDTH;
const layout = computed(() => divergingBars(props.rows, chartWidth, ROW_HEIGHT));
const chartHeight = computed(() => props.rows.length * ROW_HEIGHT);
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
  <svg
    :viewBox="`0 0 ${WIDTH} ${height}`"
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
        {{ row.label }}
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
          :class="`chart-${rect.color}`"
        >
          <title>{{ props.seriesLabels[rect.key] }}: {{ signed(rect.value) }}</title>
        </rect>
        <line :x1="layout.zeroX" :x2="layout.zeroX" :y1="0" :y2="chartHeight" class="diverging-zero" />
        <line :x1="0" :x2="chartWidth" :y1="chartHeight" :y2="chartHeight" class="diverging-axis" />
        <text :x="0" :y="chartHeight + 14" text-anchor="start" class="diverging-tick">
          {{ signed(-layout.limit) }}
        </text>
        <text :x="layout.zeroX" :y="chartHeight + 14" text-anchor="middle" class="diverging-tick">0</text>
        <text :x="chartWidth" :y="chartHeight + 14" text-anchor="end" class="diverging-tick">
          {{ signed(layout.limit) }}
        </text>
        <text :x="chartWidth / 2" :y="chartHeight + 30" text-anchor="middle" class="diverging-axis-label">
          {{ props.xLabel }}
        </text>
      </g>
    </g>
  </svg>
</template>

<style scoped>
.diverging-bar-chart {
  width: 100%;
  max-width: 40rem;
  height: auto;
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
  font-size: 0.6875rem;
}

.diverging-axis-label {
  fill: var(--p-text-muted-color);
  font-size: 0.6875rem;
}
</style>
