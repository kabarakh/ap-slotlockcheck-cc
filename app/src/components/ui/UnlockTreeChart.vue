<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';

import type { UnlockTreeNode } from '@/domain/unlock-tree';

interface ChartNode {
  node: UnlockTreeNode | null;
  children: ChartNode[];
}

const props = defineProps<{ roots: UnlockTreeNode[] }>();
const { t, d } = useI18n();

const ROW_HEIGHT = 26;
const COLUMN_WIDTH = 230;
const MARGIN = 16;
const NODE_RADIUS = 6;
const LABEL_OFFSET = 10;
const CHARACTER_WIDTH = 7;
const LABEL_GAP = 6;
const MAX_LINK_START = COLUMN_WIDTH - 40;

const labelWidth = (name: string): number =>
  Math.min(MAX_LINK_START, LABEL_OFFSET + name.length * CHARACTER_WIDTH + LABEL_GAP);

const toChartNode = (node: UnlockTreeNode): ChartNode => ({ node, children: node.children.map(toChartNode) });

const layout = computed(() => {
  const root = hierarchy<ChartNode>({ node: null, children: props.roots.map(toChartNode) });
  const positioned = tree<ChartNode>().nodeSize([ROW_HEIGHT, COLUMN_WIDTH])(root);
  const nodes = positioned.descendants().filter((point) => point.data.node !== null);
  const minX = Math.min(0, ...nodes.map((point) => point.x));
  const maxX = Math.max(0, ...nodes.map((point) => point.x));
  const maxDepth = Math.max(1, ...nodes.map((point) => point.depth));
  const toX = (point: HierarchyPointNode<ChartNode>) => MARGIN + (point.depth - 1) * COLUMN_WIDTH;
  const toY = (point: HierarchyPointNode<ChartNode>) => MARGIN + point.x - minX;
  return {
    width: MARGIN * 2 + maxDepth * COLUMN_WIDTH,
    height: MARGIN * 2 + maxX - minX,
    nodes: nodes.map((point) => ({ data: point.data.node as UnlockTreeNode, x: toX(point), y: toY(point) })),
    links: positioned
      .links()
      .filter((link) => link.source.data.node !== null)
      .map((link) => {
        const sourceX = toX(link.source) + labelWidth(link.source.data.node?.name ?? '');
        const sourceY = toY(link.source);
        const targetX = toX(link.target);
        const targetY = toY(link.target);
        const middleX = (sourceX + targetX) / 2;
        return {
          key: `${link.source.data.node?.id}-${link.target.data.node?.id}`,
          path: `M${sourceX},${sourceY} C${middleX},${sourceY} ${middleX},${targetY} ${targetX},${targetY}`,
          partial: link.target.data.node?.kind === 'partial',
        };
      }),
  };
});

const tooltip = (node: UnlockTreeNode): string =>
  [
    node.name,
    node.game,
    node.discordName ?? '',
    t(`lockStatus.${node.lockStatus}`),
    node.unlockTime ? d(new Date(node.unlockTime), 'dateTime') : '',
    node.goaled ? t('unlockTree.goaled') : '',
  ]
    .filter((line) => line.length > 0)
    .join('\n');
</script>

<template>
  <div class="unlock-tree-scroll">
    <svg
      :width="layout.width"
      :height="layout.height"
      :viewBox="`0 0 ${layout.width} ${layout.height}`"
      role="img"
      :aria-label="t('unlockTree.title')"
      data-testid="unlock-tree"
    >
      <path
        v-for="link in layout.links"
        :key="link.key"
        :d="link.path"
        class="unlock-tree-link"
        :class="{ 'unlock-tree-link-partial': link.partial }"
      />
      <g
        v-for="point in layout.nodes"
        :key="point.data.id"
        :transform="`translate(${point.x},${point.y})`"
        class="unlock-tree-node"
        :class="[`unlock-tree-node-${point.data.kind}`, { 'unlock-tree-node-goaled': point.data.goaled }]"
        :data-slot-name="point.data.name"
      >
        <title>{{ tooltip(point.data) }}</title>
        <circle :r="NODE_RADIUS" />
        <text :x="LABEL_OFFSET" dy="0.35em">{{ point.data.name }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.unlock-tree-scroll {
  overflow: auto;
  max-height: 75vh;
  border: 1px solid var(--p-content-border-color);
  border-radius: var(--p-content-border-radius);
}

.unlock-tree-link {
  fill: none;
  stroke: var(--p-surface-400);
  stroke-width: 1.25;
}

.unlock-tree-link-partial {
  stroke-dasharray: 4 3;
}

.unlock-tree-node circle {
  fill: var(--p-content-background);
  stroke: var(--p-surface-500);
  stroke-width: 2;
}

.unlock-tree-node text {
  font-size: 0.8rem;
  fill: var(--p-text-color);
  paint-order: stroke;
  stroke: var(--p-content-background);
  stroke-width: 4px;
  stroke-linejoin: round;
}

.unlock-tree-node-slotlock circle {
  fill: var(--p-primary-color);
  stroke: var(--p-primary-color);
}

.unlock-tree-node-slotlock text {
  font-weight: 700;
}

.unlock-tree-node-start circle {
  stroke: var(--p-sky-500);
}

.unlock-tree-node-partial circle {
  stroke: var(--p-orange-500);
  stroke-dasharray: 2 2;
}

.unlock-tree-node-goaled circle {
  fill: var(--p-green-500);
  stroke: var(--p-green-600);
}

.unlock-tree-node-goaled text {
  fill: var(--p-green-600);
  font-weight: 600;
}
</style>
