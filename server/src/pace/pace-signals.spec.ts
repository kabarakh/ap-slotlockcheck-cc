import { z } from 'zod';

import { loadFixture } from '../../test/fixtures/fixtures.js';
import { createSignalsReader, type SignalSlot, type SignalSnapshot, type SlotSignals } from './pace-signals.js';

interface CheeseGameFixture {
  id: number;
  position: number;
  progression_status: string;
}

interface TrackerItemsFixture {
  team: number;
  player: number;
  items: number[][];
}

const cheeseFixture = loadFixture('cheese-tracker') as { games: CheeseGameFixture[] };
const trackerFixture = loadFixture('ap-tracker') as { player_items_received: TrackerItemsFixture[] };

const slots: SignalSlot[] = cheeseFixture.games.map((game) => ({ position: game.position, cheeseGameId: game.id }));

const t1 = new Date('2026-10-28T10:00:00Z');
const t2 = new Date('2026-10-28T10:05:00Z');
const t3 = new Date('2026-10-28T10:10:00Z');
const t4 = new Date('2026-10-28T10:15:00Z');
const now = new Date('2026-10-28T12:00:00Z');

const cheese = (
  validFrom: Date,
  statuses: Record<number, string> = {},
  changes: Record<number, Record<string, string | undefined>> = {},
): SignalSnapshot => ({
  source: 'cheese',
  validFrom,
  payload: JSON.stringify({
    ...cheeseFixture,
    games: cheeseFixture.games.map((game) => ({
      ...game,
      progression_status: statuses[game.id] ?? game.progression_status,
      ...changes[game.id],
    })),
  }),
});

const tracker = (validFrom: Date, extraItems: Record<number, number[][]> = {}, team = 0): SignalSnapshot => ({
  source: 'ap_tracker',
  validFrom,
  payload: JSON.stringify({
    ...trackerFixture,
    player_items_received: trackerFixture.player_items_received.map((entry) => ({
      ...entry,
      team,
      items: [...entry.items, ...(extraItems[entry.player] ?? [])],
    })),
  }),
});

const read = (snapshots: SignalSnapshot[], at: Date = now): Map<number, SlotSignals> => {
  const reader = createSignalsReader(slots);
  for (const snapshot of snapshots) {
    reader.add(snapshot);
  }
  return reader.finish(at);
};

describe('createSignalsReader', () => {
  it('has no signals without snapshots', () => {
    const signals = read([]);
    expect([...signals.keys()]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(signals.get(1)).toEqual({ progressionItemTimes: [], bkPeriods: [], playerPeriods: [], signalsFrom: null });
  });

  it('starts the signals with the first snapshot of the room', () => {
    const signals = read([cheese(t1), tracker(t2)]);
    expect(signals.get(3)?.signalsFrom).toEqual(t1);
  });

  it('does not use the items of the first snapshot', () => {
    const signals = read([cheese(t1), tracker(t1)]);
    expect(signals.get(1)?.progressionItemTimes).toEqual([]);
    expect(signals.get(6)?.progressionItemTimes).toEqual([]);
  });

  it('does not use the items of the first tracker snapshot that is later than the first Cheese snapshot', () => {
    const signals = read([cheese(t1), tracker(t2), tracker(t3, { 3: [[1, 40001, 1, 1]] })]);
    expect(signals.get(1)?.progressionItemTimes).toEqual([]);
    expect(signals.get(3)?.progressionItemTimes).toEqual([t3]);
  });

  it('gives each new progression item the start time of its snapshot', () => {
    const signals = read([
      tracker(t1),
      tracker(t2, {
        1: [
          [2001, 20010, 2, 1],
          [2002, 20011, 2, 0],
          [2003, 20012, 3, 3],
        ],
      }),
      tracker(t3, {
        1: [
          [2001, 20010, 2, 1],
          [2002, 20011, 2, 0],
          [2003, 20012, 3, 3],
          [2004, 20013, 4, 4],
        ],
      }),
      tracker(t4, {
        1: [
          [2001, 20010, 2, 1],
          [2002, 20011, 2, 0],
          [2003, 20012, 3, 3],
          [2004, 20013, 4, 4],
          [2005, 20014, 5, 1],
        ],
        2: [[2006, 20015, 6, 1]],
      }),
    ]);
    expect(signals.get(1)?.progressionItemTimes).toEqual([t2, t2, t4]);
    expect(signals.get(2)?.progressionItemTimes).toEqual([t4]);
    expect(signals.get(3)?.progressionItemTimes).toEqual([]);
  });

  it('counts progression items from the own locations and from the server', () => {
    const signals = read([
      tracker(t1),
      tracker(t2, {
        4: [
          [3001, 50001, 4, 1],
          [3002, -2, 0, 1],
        ],
      }),
    ]);
    expect(signals.get(4)?.progressionItemTimes).toEqual([t2, t2]);
  });

  it('does not check the team of the player', () => {
    const signals = read([tracker(t1, {}, 1), tracker(t2, { 5: [[3003, 50002, 1, 1]] }, 1)]);
    expect(signals.get(5)?.progressionItemTimes).toEqual([t2]);
  });

  it('joins the BK status of more snapshots into one period', () => {
    const signals = read([
      cheese(t1, { 103: 'bk' }),
      cheese(t2, { 103: 'soft_bk' }),
      cheese(t3, { 103: 'bk', 104: 'unblocked' }),
      cheese(t4, { 103: 'go' }),
    ]);
    expect(signals.get(3)?.bkPeriods).toEqual([{ from: t1, to: t4 }]);
  });

  it('keeps a BK status up to the start of the next snapshot', () => {
    const signals = read([cheese(t1, { 102: 'go' }), cheese(t2), cheese(t3, { 102: 'unblocked' })]);
    expect(signals.get(2)?.bkPeriods).toEqual([{ from: t2, to: t3 }]);
  });

  it('keeps a BK status of the last snapshot up to now', () => {
    const signals = read([cheese(t1, { 102: 'go' }), cheese(t2, { 102: 'go' }), cheese(t3, { 102: 'soft_bk' })]);
    expect(signals.get(2)?.bkPeriods).toEqual([{ from: t3, to: now }]);
  });

  it('gives separate BK periods for each BK status', () => {
    const signals = read([cheese(t1), cheese(t2, { 102: 'go' }), cheese(t3), cheese(t4, { 102: 'unknown' })]);
    expect(signals.get(2)?.bkPeriods).toEqual([
      { from: t1, to: t2 },
      { from: t3, to: t4 },
    ]);
    expect(signals.get(1)?.bkPeriods).toEqual([]);
  });

  it('uses the Cheese game ID as the key of the BK status', () => {
    const signals = read([cheese(t1)], t2);
    expect(signals.get(2)?.bkPeriods).toEqual([{ from: t1, to: t2 }]);
    expect(
      createSignalsReader([{ position: 2, cheeseGameId: 999 }])
        .finish(t2)
        .get(2)?.bkPeriods,
    ).toEqual([]);
  });

  it('reads payloads with unknown fields and unknown status values', () => {
    const signals = read([
      { source: 'cheese', validFrom: t1, payload: JSON.stringify({ games: [{ id: 102, progression_status: 'new' }] }) },
      {
        source: 'cheese',
        validFrom: t2,
        payload: JSON.stringify({ extra: true, games: [{ id: 102, progression_status: 'bk' }] }),
      },
    ]);
    expect(signals.get(2)?.bkPeriods).toEqual([{ from: t2, to: now }]);
  });

  it('does not accept snapshots that are not sorted by time', () => {
    const reader = createSignalsReader(slots);
    reader.add(cheese(t2));
    expect(() => reader.add(cheese(t1))).toThrow('not sorted');
  });

  it('gives the player of each Cheese snapshot up to now', () => {
    const signals = read([cheese(t1)]);
    expect(signals.get(1)?.playerPeriods).toEqual([
      { from: t1, to: now, discordUserId: '100000000000000001', discordName: 'alice_owner' },
    ]);
    expect(signals.get(5)?.playerPeriods).toEqual([{ from: t1, to: now, discordUserId: null, discordName: null }]);
  });

  it('starts a new player period when the Discord user changes', () => {
    const signals = read([
      cheese(t1),
      cheese(t2, {}, { 103: { effective_discord_user_id: '100000000000000004', effective_discord_username: 'dave' } }),
      cheese(t3, {}, { 103: { effective_discord_user_id: undefined, effective_discord_username: undefined } }),
      cheese(t4),
    ]);
    expect(signals.get(3)?.playerPeriods).toEqual([
      { from: t1, to: t2, discordUserId: '100000000000000002', discordName: 'bob' },
      { from: t2, to: t3, discordUserId: '100000000000000004', discordName: 'dave' },
      { from: t3, to: t4, discordUserId: null, discordName: null },
      { from: t4, to: now, discordUserId: '100000000000000002', discordName: 'bob' },
    ]);
  });

  it('does not start a new player period when only the Discord name changes and shows the last name', () => {
    const signals = read([
      cheese(t1),
      cheese(t2, {}, { 103: { effective_discord_username: 'bobby' } }),
      cheese(t3, {}, { 103: { effective_discord_username: 'robert' } }),
    ]);
    expect(signals.get(3)?.playerPeriods).toEqual([
      { from: t1, to: now, discordUserId: '100000000000000002', discordName: 'robert' },
    ]);
  });

  it('uses the Discord username if Cheese gives no effective username', () => {
    const signals = read([cheese(t1, {}, { 101: { effective_discord_username: undefined } })]);
    expect(signals.get(1)?.playerPeriods).toEqual([
      { from: t1, to: now, discordUserId: '100000000000000001', discordName: 'organizer' },
    ]);
  });

  it('does not use a snapshot that cannot be read and does not change the state', () => {
    const reader = createSignalsReader(slots);
    const broken = reader.add({ source: 'cheese', validFrom: t1, payload: '{"games": [' });
    const invalid = reader.add({ source: 'ap_tracker', validFrom: t1, payload: JSON.stringify({ games: [] }) });
    expect(broken.read || broken.error).toBeInstanceOf(SyntaxError);
    expect(invalid.read || invalid.error).toBeInstanceOf(z.ZodError);
    expect(reader.add(cheese(t2, { 103: 'bk' }))).toEqual({ read: true });
    expect(
      reader.add({
        source: 'cheese',
        validFrom: t3,
        payload: JSON.stringify({ games: [{ id: 103, progression_status: 1 }] }),
      }),
    ).toMatchObject({ read: false });
    expect(reader.add(tracker(t3))).toEqual({ read: true });
    expect(reader.add(tracker(t4, { 3: [[1, 40001, 1, 1]] }))).toEqual({ read: true });
    const signals = reader.finish(now);
    expect(signals.get(3)).toEqual({
      progressionItemTimes: [t4],
      bkPeriods: [{ from: t2, to: now }],
      playerPeriods: [{ from: t2, to: now, discordUserId: '100000000000000002', discordName: 'bob' }],
      signalsFrom: t2,
    });
  });
});
