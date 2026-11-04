<script setup lang="ts">
import { computed } from 'vue';

import type { ChartColor } from '@/domain/charts';
import { heatmapCells } from '@/domain/statistics-charts';

const props = withDefaults(
  defineProps<{
    rowLabels: string[];
    columnLabels: string[];
    values: number[][];
    color: ChartColor;
    description: string;
    cellSize?: number;
    showValues?: boolean;
    rowTitle?: string;
    columnTitle?: string;
    labelWidth?: number;
  }>(),
  { cellSize: 22, showValues: true, rowTitle: '', columnTitle: '', labelWidth: 120 },
);

const COLUMN_LABEL_HEIGHT = 72;

const cells = computed(() => heatmapCells(props.values));
const width = computed(() => props.labelWidth + props.columnLabels.length * props.cellSize + 4);
const top = COLUMN_LABEL_HEIGHT;
const height = computed(() => top + props.rowLabels.length * props.cellSize + 4);
const shortLabel = (label: string, maxChars: number) =>
  label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
</script>

<template>
  <div class="heatmap-chart">
    <p v-if="props.rowTitle || props.columnTitle" class="app-muted heatmap-axes">
      <span v-if="props.rowTitle">↓ {{ props.rowTitle }}</span>
      <span v-if="props.columnTitle">→ {{ props.columnTitle }}</span>
    </p>
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      :style="{ maxWidth: `${width}px` }"
      role="img"
      :aria-label="props.description"
      data-testid="heatmap-chart"
    >
      <text
        v-for="(label, column) in props.columnLabels"
        :key="`column-${column}`"
        :transform="`translate(${props.labelWidth + column * props.cellSize + props.cellSize / 2} ${top - 6}) rotate(-60)`"
        class="label"
      >
        {{ shortLabel(label, 12) }}
        <title>{{ label }}</title>
      </text>
      <text
        v-for="(label, row) in props.rowLabels"
        :key="`row-${row}`"
        :x="props.labelWidth - 6"
        :y="top + row * props.cellSize + props.cellSize / 2"
        text-anchor="end"
        dominant-baseline="central"
        class="label"
      >
        {{ shortLabel(label, 18) }}
        <title>{{ label }}</title>
      </text>
      <g v-for="cell in cells" :key="`${cell.row}-${cell.column}`">
        <rect
          :x="props.labelWidth + cell.column * props.cellSize + 1"
          :y="top + cell.row * props.cellSize + 1"
          :width="props.cellSize - 2"
          :height="props.cellSize - 2"
          rx="2"
          class="empty"
        />
        <rect
          v-if="cell.opacity > 0"
          :x="props.labelWidth + cell.column * props.cellSize + 1"
          :y="top + cell.row * props.cellSize + 1"
          :width="props.cellSize - 2"
          :height="props.cellSize - 2"
          rx="2"
          :class="`chart-${props.color}`"
          :fill-opacity="cell.opacity"
          data-testid="heatmap-cell"
        >
          <title>{{ props.rowLabels[cell.row] }} → {{ props.columnLabels[cell.column] }}: {{ cell.value }}</title>
        </rect>
        <text
          v-if="props.showValues && cell.value > 0"
          :x="props.labelWidth + cell.column * props.cellSize + props.cellSize / 2"
          :y="top + cell.row * props.cellSize + props.cellSize / 2"
          text-anchor="middle"
          dominant-baseline="central"
          class="value"
        >
          {{ cell.value }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.heatmap-chart svg {
  width: 100%;
  height: auto;
}

.empty {
  fill: var(--p-content-hover-background);
}

.label {
  fill: var(--p-text-color);
  font-size: 0.6875rem;
}

.heatmap-axes {
  display: flex;
  gap: var(--app-gap);
  margin: 0 0 0.25rem;
  font-size: 0.8125rem;
}

.value {
  fill: var(--p-text-color);
  font-size: 0.625rem;
  font-weight: 700;
  pointer-events: none;
}
</style>
