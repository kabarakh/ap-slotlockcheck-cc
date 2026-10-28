<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { SlotTimeline } from '@/api/types';
import { formatDuration } from '@/domain/duration';
import { paceTimelineLayout, SEGMENT_KINDS, type TimelinePeriod } from '@/domain/pace-timeline';

const props = defineProps<{
  timeline: SlotTimeline;
  highlight: TimelinePeriod | null;
  slotName: string;
  showLocked: boolean;
}>();
const { t, d } = useI18n();

const WIDTH = 760;
const LABEL_WIDTH = 84;
const RIGHT = 16;
const PLOT_WIDTH = WIDTH - LABEL_WIDTH - RIGHT;
const LANES = {
  players: { y: 4, height: 20 },
  segments: { y: 30, height: 28 },
  items: { y: 64, height: 12 },
  statuses: { y: 82, height: 26 },
  unreadable: { y: 114, height: 12 },
};
const AXIS_Y = 132;
const HEIGHT = AXIS_Y + 22;
const STATUS_LABEL_WIDTH = 60;
const MARK_KEYS = ['item', 'status', 'player', 'unreadable', 'highlight'] as const;
const legendKinds = computed(() =>
  props.showLocked ? SEGMENT_KINDS : SEGMENT_KINDS.filter((kind) => kind !== 'locked'),
);

const layout = computed(() =>
  paceTimelineLayout(props.timeline, {
    width: PLOT_WIDTH,
    highlight: props.highlight,
    tickCount: 6,
    statusLabelWidth: STATUS_LABEL_WIDTH,
  }),
);

const time = (value: string | Date): string => d(new Date(value), 'dateTime');
const tickLabel = (value: Date): string =>
  value.getHours() === 0 && value.getMinutes() === 0 ? d(value, 'day') : d(value, 'time');
const minutesBetween = (from: string, to: string): number =>
  (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
const playerName = (name: string | null): string => name ?? t('pace.noPlayer');
const description = computed(() =>
  t('pace.timeline.description', {
    slot: props.slotName,
    from: time(props.timeline.from),
    to: time(props.timeline.to),
  }),
);
const playerLabel = (name: string | null, width: number): string => {
  const text = playerName(name);
  const maxChars = Math.floor((width - 8) / 6);
  if (maxChars < 3) {
    return '';
  }
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
};
</script>

<template>
  <div class="pace-timeline" data-testid="pace-timeline">
    <div class="pace-timeline-scroll">
      <svg :viewBox="`0 0 ${WIDTH} ${HEIGHT}`" role="img" :aria-label="description" class="pace-timeline-svg">
        <g class="lane-labels">
          <text
            v-for="(lane, key) in LANES"
            :key="key"
            :x="LABEL_WIDTH - 8"
            :y="lane.y + lane.height / 2"
            text-anchor="end"
            dominant-baseline="central"
          >
            {{ t(`pace.timeline.lanes.${key}`) }}
          </text>
        </g>
        <g :transform="`translate(${LABEL_WIDTH} 0)`">
          <g class="ticks">
            <g v-for="tick in layout.ticks" :key="tick.time.getTime()">
              <line :x1="tick.x" :x2="tick.x" :y1="0" :y2="AXIS_Y" class="tick-line" />
              <text :x="tick.x" :y="AXIS_Y + 14" text-anchor="middle" class="tick-label">
                {{ tickLabel(tick.time) }}
              </text>
            </g>
            <line :x1="0" :x2="PLOT_WIDTH" :y1="AXIS_Y" :y2="AXIS_Y" class="axis" />
          </g>
          <g data-testid="pace-timeline-players">
            <g v-for="player in layout.players" :key="player.from">
              <rect
                :x="player.x"
                :y="LANES.players.y"
                :width="player.width"
                :height="LANES.players.height"
                rx="3"
                class="player"
                :class="{ 'player-highlighted': player.highlighted }"
              >
                <title>
                  {{
                    t('pace.timeline.playerTitle', {
                      player: playerName(player.discordName),
                      from: time(player.from),
                      to: time(player.to),
                    })
                  }}
                </title>
              </rect>
              <text
                :x="player.x + 4"
                :y="LANES.players.y + LANES.players.height / 2"
                dominant-baseline="central"
                class="player-label"
              >
                {{ playerLabel(player.discordName, player.width) }}
              </text>
            </g>
          </g>
          <g data-testid="pace-timeline-segments">
            <rect
              v-for="segment in layout.segments"
              :key="segment.from"
              :x="segment.x"
              :y="LANES.segments.y"
              :width="segment.width"
              :height="LANES.segments.height"
              :class="`pace-${segment.kind}`"
              :data-kind="segment.kind"
            >
              <title>
                {{
                  t('pace.timeline.segmentTitle', {
                    kind: t(`pace.timeline.kinds.${segment.kind}`),
                    from: time(segment.from),
                    to: time(segment.to),
                    duration: formatDuration(minutesBetween(segment.from, segment.to)),
                    checks: segment.checks,
                  })
                }}
              </title>
            </rect>
          </g>
          <g data-testid="pace-timeline-items">
            <path
              v-for="(item, index) in layout.items"
              :key="index"
              :d="`M ${item.x - 4} ${LANES.items.y} L ${item.x + 4} ${LANES.items.y} L ${item.x} ${LANES.items.y + LANES.items.height} Z`"
              class="item"
            >
              <title>{{ t('pace.timeline.itemTitle', { time: time(item.time) }) }}</title>
            </path>
          </g>
          <g data-testid="pace-timeline-statuses">
            <g v-for="(status, index) in layout.statuses" :key="index">
              <line
                :x1="status.x"
                :x2="status.x"
                :y1="LANES.statuses.y"
                :y2="LANES.statuses.y + LANES.statuses.height"
                class="status"
              >
                <title>
                  {{
                    t('pace.timeline.statusTitle', {
                      status: t(`progression.${status.status}`),
                      time: time(status.time),
                    })
                  }}
                </title>
              </line>
              <text
                v-if="status.showLabel"
                :x="status.x > PLOT_WIDTH - STATUS_LABEL_WIDTH ? status.x - 3 : status.x + 3"
                :y="LANES.statuses.y + 9"
                :text-anchor="status.x > PLOT_WIDTH - STATUS_LABEL_WIDTH ? 'end' : 'start'"
                class="status-label"
              >
                {{ t(`progression.${status.status}`) }}
              </text>
            </g>
          </g>
          <g data-testid="pace-timeline-unreadable">
            <rect
              v-for="period in layout.unreadable"
              :key="period.from"
              :x="period.x"
              :y="LANES.unreadable.y"
              :width="Math.max(period.width, 2)"
              :height="LANES.unreadable.height"
              class="unreadable"
            >
              <title>{{ t('pace.timeline.unreadableTitle', { from: time(period.from), to: time(period.to) }) }}</title>
            </rect>
          </g>
          <g v-if="layout.highlight" data-testid="pace-timeline-highlight">
            <rect :x="0" :y="0" :width="layout.highlight.x" :height="AXIS_Y" class="dim" />
            <rect
              :x="layout.highlight.x + layout.highlight.width"
              :y="0"
              :width="PLOT_WIDTH - layout.highlight.x - layout.highlight.width"
              :height="AXIS_Y"
              class="dim"
            />
            <rect
              :x="layout.highlight.x"
              :y="1"
              :width="layout.highlight.width"
              :height="AXIS_Y - 2"
              class="highlight"
            />
          </g>
          <g data-testid="pace-timeline-player-changes">
            <line
              v-for="change in layout.playerChanges"
              :key="change.time"
              :x1="change.x"
              :x2="change.x"
              :y1="0"
              :y2="AXIS_Y"
              class="player-change"
            >
              <title>{{ t('pace.timeline.playerChangeTitle', { time: time(change.time) }) }}</title>
            </line>
          </g>
        </g>
      </svg>
    </div>
    <ul class="legend" data-testid="pace-timeline-legend">
      <li v-for="kind in legendKinds" :key="kind">
        <span class="chart-legend" :class="`pace-${kind}`" />{{ t(`pace.timeline.kinds.${kind}`) }}
      </li>
      <li v-for="mark in MARK_KEYS" :key="mark">
        <span class="chart-legend" :class="`legend-${mark}`" />{{ t(`pace.timeline.marks.${mark}`) }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pace-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pace-timeline-scroll {
  overflow-x: auto;
}

.pace-timeline-svg {
  display: block;
  width: 100%;
  min-width: 40rem;
  height: auto;
}

.lane-labels text,
.player-label,
.status-label,
.tick-label {
  fill: var(--p-text-color);
  font-size: 0.6875rem;
}

.tick-label {
  fill: var(--p-text-muted-color);
}

.status-label {
  paint-order: stroke;
  stroke: var(--p-content-background);
  stroke-width: 3px;
}

.tick-line {
  stroke: var(--p-content-border-color);
  stroke-dasharray: 2 3;
}

.axis {
  stroke: var(--p-text-muted-color);
}

.player {
  fill: var(--app-pace-player);
  stroke: var(--p-content-border-color);
}

.player-highlighted {
  stroke: var(--app-pace-highlight);
  stroke-width: 2;
}

.item {
  fill: var(--app-pace-item);
}

.status {
  stroke: var(--app-pace-status);
  stroke-width: 2;
}

.unreadable {
  fill: var(--app-pace-unreadable);
}

.dim {
  fill: var(--app-pace-dim);
  pointer-events: none;
}

.highlight {
  fill: none;
  stroke: var(--app-pace-highlight);
  stroke-width: 2;
  pointer-events: none;
}

.player-change {
  stroke: var(--app-pace-player-change);
  stroke-width: 2;
  stroke-dasharray: 4 3;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8125rem;
}

.legend li {
  display: inline-flex;
  align-items: center;
}

.legend-item {
  background: var(--app-pace-item);
}

.legend-status {
  background: var(--app-pace-status);
}

.legend-player {
  background: var(--app-pace-player-change);
}

.legend-unreadable {
  background: var(--app-pace-unreadable);
}

.legend-highlight {
  background: transparent;
  border: 2px solid var(--app-pace-highlight);
}
</style>
