import { describe, expect, it } from 'vite-plus/test';

import { paceTimelineLayout } from '../pace-timeline';
import type { SlotTimeline } from '@/api/types';

const at = (minutes: number): string => new Date(Date.UTC(2026, 9, 28, 10, minutes)).toISOString();

const timeline = (overrides: Partial<SlotTimeline> = {}): SlotTimeline => ({
  slotId: 1,
  from: at(0),
  to: at(100),
  segments: [
    { kind: 'active', from: at(0), to: at(20), checks: 5 },
    { kind: 'bk', from: at(20), to: at(60), checks: 0 },
    { kind: 'active', from: at(60), to: at(100), checks: 8 },
  ],
  progressionItemTimes: [at(50), at(200)],
  statusChanges: [
    { time: at(-30), status: 'unblocked' },
    { time: at(-10), status: 'go' },
    { time: at(30), status: 'bk' },
    { time: at(32), status: 'go' },
  ],
  playerPeriods: [
    { from: at(0), to: at(40), discordUserId: '1', discordName: 'Alice' },
    { from: at(40), to: at(100), discordUserId: '2', discordName: 'Bob' },
  ],
  unreadableSnapshots: [{ from: at(70), to: at(80) }],
  ...overrides,
});

const options = { width: 1000, highlight: { from: at(40), to: at(100) }, tickCount: 5, statusLabelWidth: 50 };

describe('paceTimelineLayout', () => {
  it('places the segments on the time axis', () => {
    const layout = paceTimelineLayout(timeline(), options);
    expect(layout.segments.map(({ kind, x, width }) => ({ kind, x, width }))).toEqual([
      { kind: 'active', x: 0, width: 200 },
      { kind: 'bk', x: 200, width: 400 },
      { kind: 'active', x: 600, width: 400 },
    ]);
  });

  it('extends the axis to segments outside of the time range', () => {
    const layout = paceTimelineLayout(
      timeline({ segments: [{ kind: 'locked', from: at(-100), to: at(0), checks: 0 }] }),
      options,
    );
    expect(layout.segments[0]).toMatchObject({ x: 0, width: 500 });
  });

  it('highlights the clicked row and the player periods in it', () => {
    const layout = paceTimelineLayout(timeline(), options);
    expect(layout.highlight).toMatchObject({ x: 400, width: 600 });
    expect(layout.players.map((player) => player.highlighted)).toEqual([false, true]);
    expect(layout.playerChanges.map((change) => change.x)).toEqual([400]);
  });

  it('shows only the marks inside of the axis and the last status before it', () => {
    const layout = paceTimelineLayout(timeline(), options);
    expect(layout.items.map((item) => item.x)).toEqual([500]);
    expect(layout.statuses.map(({ status, x }) => ({ status, x }))).toEqual([
      { status: 'go', x: 0 },
      { status: 'bk', x: 300 },
      { status: 'go', x: 320 },
    ]);
    expect(layout.unreadable).toMatchObject([{ x: 700, width: 100 }]);
  });

  it('hides the labels of status marks that are too near to the last label', () => {
    const layout = paceTimelineLayout(timeline(), options);
    expect(layout.statuses.map((status) => status.showLabel)).toEqual([true, true, false]);
  });

  it('gives the time before the first snapshot to the player of the first snapshot', () => {
    const layout = paceTimelineLayout(
      timeline({ playerPeriods: [{ from: at(50), to: at(100), discordUserId: '1', discordName: 'Alice' }] }),
      options,
    );
    expect(layout.players).toMatchObject([{ from: at(0), x: 0, width: 1000 }]);
    expect(layout.playerChanges).toEqual([]);
  });

  it('has no highlight without a clicked row', () => {
    const layout = paceTimelineLayout(timeline(), { ...options, highlight: null });
    expect(layout.highlight).toBeNull();
    expect(layout.players.every((player) => !player.highlighted)).toBe(true);
  });
});
