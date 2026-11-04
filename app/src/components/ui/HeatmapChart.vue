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
    columnLabelHeight?: number;
  }>(),
  { cellSize: 28, showValues: true, rowTitle: '', columnTitle: '', labelWidth: 130, columnLabelHeight: 80 },
);

const cells = computed(() => heatmapCells(props.values));
const width = computed(() => props.labelWidth + props.columnLabels.length * props.cellSize + 4);
const top = computed(() => props.columnLabelHeight);
const height = computed(() => top.value + props.rowLabels.length * props.cellSize + 4);
const cellX = (column: number) => props.labelWidth + column * props.cellSize;
const cellY = (row: number) => top.value + row * props.cellSize;
const shortLabel = (label: string, maxChars: number) =>
  label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
</script>

<template>
  <div class="heatmap-chart">
    <p v-if="props.rowTitle || props.columnTitle" class="app-muted heatmap-axes">
      <span v-if="props.rowTitle">↓ {{ props.rowTitle }}</span>
      <span v-if="props.columnTitle">→ {{ props.columnTitle }}</span>
    </p>
    <div class="heatmap-scroll">
      <svg
        :viewBox="`0 0 ${width} ${height}`"
        :width="width"
        :height="height"
        role="img"
        :aria-label="props.description"
        data-testid="heatmap-chart"
      >
        <text
          v-for="(label, column) in props.columnLabels"
          :key="`column-${column}`"
          :transform="`translate(${cellX(column) + props.cellSize / 2 + 4} ${top - 6}) rotate(-55)`"
          class="label"
        >
          {{ shortLabel(label, 12) }}
          <title>{{ label }}</title>
        </text>
        <text
          v-for="(label, row) in props.rowLabels"
          :key="`row-${row}`"
          :x="props.labelWidth - 8"
          :y="cellY(row) + props.cellSize / 2"
          text-anchor="end"
          dominant-baseline="central"
          class="label"
        >
          {{ shortLabel(label, 18) }}
          <title>{{ label }}</title>
        </text>
        <g v-for="cell in cells" :key="`${cell.row}-${cell.column}`">
          <rect
            :x="cellX(cell.column) + 1"
            :y="cellY(cell.row) + 1"
            :width="props.cellSize - 2"
            :height="props.cellSize - 2"
            rx="3"
            class="empty"
          />
          <rect
            v-if="cell.opacity > 0"
            :x="cellX(cell.column) + 1"
            :y="cellY(cell.row) + 1"
            :width="props.cellSize - 2"
            :height="props.cellSize - 2"
            rx="3"
            :class="`chart-${props.color}`"
            :fill-opacity="cell.opacity"
            data-testid="heatmap-cell"
          >
            <title>{{ props.rowLabels[cell.row] }} → {{ props.columnLabels[cell.column] }}: {{ cell.value }}</title>
          </rect>
          <text
            v-if="props.showValues && cell.value > 0"
            :x="cellX(cell.column) + props.cellSize / 2"
            :y="cellY(cell.row) + props.cellSize / 2"
            text-anchor="middle"
            dominant-baseline="central"
            class="value"
            :class="cell.strong ? `chart-on-${props.color}` : 'value-weak'"
            data-testid="heatmap-value"
          >
            {{ cell.value }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.heatmap-scroll {
  overflow-x: auto;
}

.heatmap-scroll svg {
  display: block;
}

.empty {
  fill: var(--p-content-hover-background);
}

.label {
  fill: var(--p-text-color);
  font-size: 12px;
}

.value {
  font-size: 12px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.value-weak {
  fill: var(--p-text-color);
}

.heatmap-axes {
  display: flex;
  gap: var(--app-gap);
  margin: 0 0 0.25rem;
  font-size: 0.8125rem;
}
</style>
