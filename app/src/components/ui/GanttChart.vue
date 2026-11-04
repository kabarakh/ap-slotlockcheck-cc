<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { useElementWidth } from './use-element-width';
import { ganttLayout, timeTickFormat, type GanttRow } from '@/domain/statistics-charts';

const props = defineProps<{ rows: GanttRow[]; description: string }>();
const { d } = useI18n();

const LABEL_WIDTH = 180;
const RIGHT = 16;
const ROW_HEIGHT = 20;
const AXIS_HEIGHT = 26;

const container = useTemplateRef<HTMLElement>('container');
const width = useElementWidth(container, 760);
const plotWidth = computed(() => width.value - LABEL_WIDTH - RIGHT);
const layout = computed(() => ganttLayout(props.rows, plotWidth.value));
const height = computed(() => props.rows.length * ROW_HEIGHT + AXIS_HEIGHT);
const rowIndex = computed(() => new Map(props.rows.map((row, index) => [row.key, index])));
const rowY = (key: string) => (rowIndex.value.get(key) ?? 0) * ROW_HEIGHT;
const tickLabel = (time: number): string => {
  const value = new Date(time);
  const format = timeTickFormat(layout.value.ticks, time);
  return format === 'dayTime' ? `${d(value, 'day')} ${d(value, 'time')}` : d(value, format);
};
const shortLabel = (label: string) => (label.length > 24 ? `${label.slice(0, 23)}…` : label);
</script>

<template>
  <div ref="container" class="gantt-chart">
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      :aria-label="props.description"
      data-testid="gantt-chart"
    >
      <text
        v-for="(row, index) in props.rows"
        :key="`label-${row.key}`"
        :x="LABEL_WIDTH - 6"
        :y="index * ROW_HEIGHT + ROW_HEIGHT / 2"
        text-anchor="end"
        dominant-baseline="central"
        class="label"
      >
        {{ shortLabel(row.label) }}
        <title>{{ row.label }}</title>
      </text>
      <g :transform="`translate(${LABEL_WIDTH} 0)`">
        <rect
          v-for="(rect, index) in layout.rects"
          :key="`rect-${index}`"
          :x="rect.x"
          :y="rowY(rect.rowKey) + 5"
          :width="rect.width"
          :height="ROW_HEIGHT - 10"
          rx="2"
          :class="rect.kind === 'locked' ? 'chart-rest' : 'chart-checks'"
          :data-kind="rect.kind"
        />
        <circle
          v-for="goal in layout.goals"
          :key="`goal-${goal.rowKey}`"
          :cx="goal.x"
          :cy="rowY(goal.rowKey) + ROW_HEIGHT / 2"
          r="5"
          class="chart-goal goal"
          data-testid="gantt-goal"
        />
        <line :x1="0" :x2="plotWidth" :y1="height - AXIS_HEIGHT" :y2="height - AXIS_HEIGHT" class="axis" />
        <text
          v-for="tick in layout.ticks"
          :key="`tick-${tick.value}`"
          :x="tick.position"
          :y="height - AXIS_HEIGHT + 18"
          text-anchor="middle"
          class="tick"
        >
          {{ tickLabel(tick.value) }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.gantt-chart {
  max-height: 32rem;
  overflow-y: auto;
}

.gantt-chart svg {
  display: block;
}

.label {
  fill: var(--p-text-color);
  font-size: 12px;
}

.tick {
  fill: var(--p-text-muted-color);
  font-size: 12px;
}

.axis {
  stroke: var(--p-content-border-color);
}

.goal {
  stroke: var(--p-content-background);
  stroke-width: 1.5;
}
</style>
