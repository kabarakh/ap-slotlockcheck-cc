import type { PlayerPeriod, SlotSignals } from './pace-signals.js';
import {
  classifySlot,
  gamePaceValues,
  slotPaceRows,
  slotRange,
  type PaceLimits,
  type Segment,
  type SegmentKind,
  type SlotPaceInput,
  type SlotPaceRow,
  type SlotRange,
  type SlotRangeInput,
} from './pace.logic.js';

const base = new Date('2026-10-28T10:00:00Z');
const at = (minutes: number) => new Date(base.getTime() + minutes * 60_000);

const history = (...points: [number, number][]) => points.map(([minutes, checks]) => ({ time: at(minutes), checks }));

const range = (start: number, end: number, startKind: SlotRange['startKind'] = 'unlock'): SlotRange => ({
  start: at(start),
  end: at(end),
  startKind,
});

const player = (from: number, to: number, discordUserId: string | null, discordName: string | null): PlayerPeriod => ({
  from: at(from),
  to: at(to),
  discordUserId,
  discordName,
});

const signals = (overrides: Partial<SlotSignals> = {}): SlotSignals => ({
  progressionItemTimes: [],
  bkPeriods: [],
  playerPeriods: [player(-1000, 1000, '1', 'alice')],
  signalsFrom: at(-1000),
  ...overrides,
});

const limits: PaceLimits = { breakLimitMinutes: 30, bulkLimitChecks: 40 };

const input = (overrides: Partial<SlotPaceInput> = {}): SlotPaceInput => ({
  history: [],
  range: range(0, 1000),
  signals: signals(),
  limits,
  currentPlayer: { discordUserId: '1', discordName: 'alice' },
  ...overrides,
});

const segment = (kind: SegmentKind, from: number, to: number, checks = 0): Segment => ({
  kind,
  from: at(from),
  to: at(to),
  checks,
});

const onlyRow = (slot: SlotPaceInput): SlotPaceRow => {
  const rows = slotPaceRows(slot);
  expect(rows).toHaveLength(1);
  return rows[0];
};

describe('classifySlot and slotPaceRows', () => {
  it('counts the active steps between the unlock and the goal', () => {
    const slot = input({
      history: history([-10, 0], [0, 0], [10, 5], [20, 10], [30, 20], [40, 30], [50, 35]),
      range: range(0, 40),
    });
    expect(classifySlot(slot)).toEqual([
      segment('locked', -10, 0),
      segment('active', 0, 40, 30),
      segment('after_goal', 40, 50, 5),
    ]);
    expect(onlyRow(slot)).toEqual({
      discordUserId: '1',
      discordName: 'alice',
      from: at(0),
      to: at(40),
      activeMinutes: 40,
      checks: 30,
      checksPerHour: 45,
      minutesPerCheck: 40 / 30,
      bkMinutes: 0,
      bkShare: 0,
      bkCount: 0,
      longestBkMinutes: 0,
      breakMinutes: 0,
      startKind: 'unlock',
      partialSignals: false,
    });
  });

  it('cuts a step at the start and at the end of the range', () => {
    expect(classifySlot(input({ history: history([0, 0], [10, 3], [20, 6]), range: range(5, 15) }))).toEqual([
      segment('locked', 0, 5),
      segment('active', 5, 15, 6),
      segment('after_goal', 15, 20),
    ]);
  });

  it('sorts the history points by time', () => {
    expect(classifySlot(input({ history: history([20, 10], [0, 0], [10, 5]), range: range(0, 20) }))).toEqual([
      segment('active', 0, 20, 10),
    ]);
  });

  it('ends a BK period with the first check, also if Cheese still shows BK', () => {
    const slot = input({
      history: history([0, 0], [10, 5], [20, 5], [30, 5], [40, 5], [50, 8], [60, 12]),
      range: range(0, 60),
      signals: signals({ bkPeriods: [{ from: at(15), to: at(70) }], progressionItemTimes: [at(35)] }),
    });
    expect(classifySlot(slot)).toEqual([
      segment('active', 0, 10, 5),
      segment('bk', 10, 40),
      segment('active', 40, 60, 7),
    ]);
    expect(onlyRow(slot)).toMatchObject({
      activeMinutes: 30,
      checks: 12,
      bkMinutes: 30,
      bkShare: 0.5,
      bkCount: 1,
      longestBkMinutes: 30,
      breakMinutes: 0,
    });
  });

  it('classifies a quiet period as BK if a progression item comes in the next active step', () => {
    const quiet = history([0, 0], [10, 5], [20, 5], [30, 5], [40, 9]);
    expect(
      classifySlot(
        input({ history: quiet, range: range(0, 40), signals: signals({ progressionItemTimes: [at(35)] }) }),
      ),
    ).toEqual([segment('active', 0, 10, 5), segment('bk', 10, 30), segment('active', 30, 40, 4)]);
    expect(
      classifySlot(
        input({ history: quiet, range: range(0, 40), signals: signals({ progressionItemTimes: [at(45)] }) }),
      ),
    ).toEqual([segment('active', 0, 10, 5), segment('pause', 10, 30), segment('active', 30, 40, 4)]);
  });

  it('counts a progression item from the own locations in the quiet period', () => {
    expect(
      classifySlot(
        input({
          history: history([0, 0], [10, 5], [20, 5], [30, 5], [40, 9]),
          range: range(0, 40),
          signals: signals({ progressionItemTimes: [at(25)] }),
        }),
      ),
    ).toEqual([segment('active', 0, 10, 5), segment('bk', 10, 30), segment('active', 30, 40, 4)]);
  });

  it('does not count a progression item at the start of the quiet period', () => {
    expect(
      classifySlot(
        input({
          history: history([0, 0], [10, 5], [20, 5], [30, 9]),
          range: range(0, 30),
          signals: signals({ progressionItemTimes: [at(10)] }),
        }),
      ),
    ).toEqual([segment('active', 0, 10, 5), segment('pause', 10, 20), segment('active', 20, 30, 4)]);
  });

  it('classifies a quiet period without signals as pause or break', () => {
    expect(classifySlot(input({ history: history([0, 0], [10, 5], [30, 5], [40, 9]), range: range(0, 40) }))).toEqual([
      segment('active', 0, 10, 5),
      segment('pause', 10, 30),
      segment('active', 30, 40, 4),
    ]);
    const long = input({ history: history([0, 0], [10, 5], [130, 5], [140, 9]), range: range(0, 140) });
    expect(classifySlot(long)).toEqual([
      segment('active', 0, 10, 5),
      segment('break', 10, 130),
      segment('active', 130, 140, 4),
    ]);
    expect(onlyRow(long)).toMatchObject({ activeMinutes: 20, breakMinutes: 120, bkCount: 0 });
  });

  it('classifies a quiet period at the end as BK only with the status of Cheese', () => {
    const quiet = history([0, 0], [10, 5], [20, 5], [30, 5], [40, 5], [50, 5], [60, 5]);
    expect(classifySlot(input({ history: quiet, range: range(0, 60) }))).toEqual([
      segment('active', 0, 10, 5),
      segment('break', 10, 60),
    ]);
    expect(
      classifySlot(
        input({ history: quiet, range: range(0, 60), signals: signals({ progressionItemTimes: [at(30)] }) }),
      ),
    ).toEqual([segment('active', 0, 10, 5), segment('break', 10, 60)]);
    expect(
      classifySlot(
        input({ history: quiet, range: range(0, 60), signals: signals({ bkPeriods: [{ from: at(30), to: at(60) }] }) }),
      ),
    ).toEqual([segment('active', 0, 10, 5), segment('bk', 10, 60)]);
  });

  it('does not count a bulk step after a release', () => {
    const slot = input({ history: history([0, 0], [10, 5], [20, 10], [30, 15], [40, 115]), range: range(0, 40) });
    expect(classifySlot(slot)).toEqual([segment('active', 0, 30, 15), segment('bulk', 30, 40, 100)]);
    expect(onlyRow(slot)).toMatchObject({ activeMinutes: 30, checks: 15, checksPerHour: 30 });
  });

  it('continues a quiet period over a bulk step and does not count its checks', () => {
    const quiet = history([0, 0], [10, 5], [20, 5], [30, 105], [40, 105], [50, 110]);
    const slot = input({ history: quiet, range: range(0, 50), limits: { breakLimitMinutes: 20, bulkLimitChecks: 40 } });
    expect(classifySlot(slot)).toEqual([
      segment('active', 0, 10, 5),
      segment('break', 10, 20),
      segment('bulk', 20, 30, 100),
      segment('break', 30, 40),
      segment('active', 40, 50, 5),
    ]);
    expect(onlyRow(slot)).toMatchObject({ activeMinutes: 20, checks: 10, breakMinutes: 20 });

    const bk = input({ ...slot, signals: signals({ progressionItemTimes: [at(45)] }) });
    expect(classifySlot(bk)).toEqual([
      segment('active', 0, 10, 5),
      segment('bk', 10, 20),
      segment('bulk', 20, 30, 100),
      segment('bk', 30, 40),
      segment('active', 40, 50, 5),
    ]);
    expect(onlyRow(bk)).toMatchObject({ bkMinutes: 20, bkCount: 1, longestBkMinutes: 20 });
  });

  it('uses only pause and break for quiet periods before the start of the signals', () => {
    const slot = input({
      history: history([0, 0], [10, 5], [20, 5], [30, 5], [40, 5], [50, 9], [60, 9], [70, 12]),
      range: range(0, 70),
      signals: signals({
        signalsFrom: at(55),
        progressionItemTimes: [at(45), at(65)],
        bkPeriods: [{ from: at(10), to: at(50) }],
      }),
    });
    expect(classifySlot(slot)).toEqual([
      segment('active', 0, 10, 5),
      segment('pause', 10, 40),
      segment('active', 40, 50, 4),
      segment('bk', 50, 60),
      segment('active', 60, 70, 3),
    ]);
    expect(onlyRow(slot).partialSignals).toBe(true);
  });

  it('uses only pause and break without signal data', () => {
    expect(
      classifySlot(
        input({
          history: history([0, 0], [10, 5], [20, 5], [30, 9]),
          range: range(0, 30),
          signals: signals({
            signalsFrom: null,
            progressionItemTimes: [at(15)],
            bkPeriods: [{ from: at(10), to: at(20) }],
          }),
        }),
      ),
    ).toEqual([segment('active', 0, 10, 5), segment('pause', 10, 20), segment('active', 20, 30, 4)]);
  });

  it('counts a negative check difference as a step without new checks', () => {
    expect(classifySlot(input({ history: history([0, 10], [10, 8], [20, 12]), range: range(0, 20) }))).toEqual([
      segment('pause', 0, 10),
      segment('active', 10, 20, 4),
    ]);
  });

  it('uses the break limit of the room', () => {
    const quiet = history([0, 0], [10, 5], [55, 5], [65, 10]);
    expect(
      classifySlot(
        input({ history: quiet, range: range(0, 65), limits: { breakLimitMinutes: 60, bulkLimitChecks: 40 } }),
      ),
    ).toEqual([segment('active', 0, 10, 5), segment('pause', 10, 55), segment('active', 55, 65, 5)]);
    expect(
      classifySlot(
        input({ history: quiet, range: range(0, 65), limits: { breakLimitMinutes: 30, bulkLimitChecks: 40 } }),
      ),
    ).toEqual([segment('active', 0, 10, 5), segment('break', 10, 55), segment('active', 55, 65, 5)]);
  });

  it('gives a pace only from 30 minutes of active time', () => {
    expect(onlyRow(input({ history: history([0, 0], [10, 5], [20, 10]), range: range(0, 20) }))).toMatchObject({
      activeMinutes: 20,
      checks: 10,
      checksPerHour: null,
      minutesPerCheck: null,
    });
    expect(
      onlyRow(input({ history: history([0, 0], [10, 5], [20, 10], [30, 15], [40, 20]), range: range(0, 40) })),
    ).toMatchObject({ activeMinutes: 40, checks: 20, checksPerHour: 30, minutesPerCheck: 2 });
  });

  it('gives no pace without checks', () => {
    expect(onlyRow(input({ history: history([0, 0], [10, 0], [20, 0], [30, 0]), range: range(0, 30) }))).toMatchObject({
      activeMinutes: 30,
      checks: 0,
      checksPerHour: null,
      minutesPerCheck: null,
    });
  });

  it('accepts steps of different length', () => {
    const slot = input({ history: history([0, 0], [10, 5], [20, 10], [80, 40]), range: range(0, 80) });
    expect(classifySlot(slot)).toEqual([segment('active', 0, 80, 40)]);
    expect(onlyRow(slot)).toMatchObject({ activeMinutes: 80, checks: 40, checksPerHour: 30 });
    expect(
      classifySlot(input({ history: history([0, 0], [10, 5], [20, 10], [80, 10], [90, 15]), range: range(0, 90) })),
    ).toEqual([segment('active', 0, 20, 10), segment('break', 20, 80), segment('active', 80, 90, 5)]);
  });

  it('classifies the time from the start to the first check as a quiet period', () => {
    const points = history([0, 0], [10, 0], [20, 0], [30, 5], [40, 9]);
    expect(classifySlot(input({ history: points, range: range(0, 40) }))).toEqual([
      segment('pause', 0, 20),
      segment('active', 20, 40, 9),
    ]);
    expect(
      classifySlot(
        input({ history: points, range: range(0, 40), signals: signals({ progressionItemTimes: [at(25)] }) }),
      ),
    ).toEqual([segment('bk', 0, 20), segment('active', 20, 40, 9)]);
  });

  it('uses the signals for a quiet period that ends after the start of the signals', () => {
    expect(
      classifySlot(
        input({
          history: history([0, 0], [10, 5], [20, 5], [30, 5], [40, 9]),
          range: range(0, 40),
          signals: signals({ signalsFrom: at(25), bkPeriods: [{ from: at(25), to: at(35) }] }),
        }),
      ),
    ).toEqual([segment('active', 0, 10, 5), segment('bk', 10, 30), segment('active', 30, 40, 4)]);
  });

  it('has no segments after the last history point', () => {
    const slot = input({ history: history([0, 0], [10, 5], [20, 5], [30, 5]), range: range(0, 100) });
    expect(classifySlot(slot)).toEqual([segment('active', 0, 10, 5), segment('pause', 10, 30)]);
    expect(onlyRow(slot)).toMatchObject({ to: at(100), activeMinutes: 30, breakMinutes: 0 });
  });

  it('has no segments and no rows without range', () => {
    const slot = input({ history: history([0, 0], [10, 5]), range: null });
    expect(classifySlot(slot)).toEqual([]);
    expect(slotPaceRows(slot)).toEqual([]);
  });

  it('marks the start kind and partial signals', () => {
    const points = history([0, 0], [10, 5]);
    expect(onlyRow(input({ history: points, range: range(0, 10, 'estimated') }))).toMatchObject({
      startKind: 'estimated',
      partialSignals: false,
    });
    expect(
      onlyRow(input({ history: points, range: range(0, 10, 'unknown'), signals: signals({ signalsFrom: at(5) }) })),
    ).toMatchObject({ startKind: 'unknown', partialSignals: true });
  });
});

describe('slotRange', () => {
  const now = at(500);
  const rangeInput = (overrides: Partial<SlotRangeInput> = {}): SlotRangeInput => ({
    lock: { status: 'unlocked', unlockTime: at(60), unlockTimeSource: 'sync' },
    goalReached: false,
    goalTime: null,
    firstHistoryTime: at(0),
    now,
    ...overrides,
  });

  it('has no range for a locked slot and a partially unlocked slot', () => {
    expect(slotRange(rangeInput({ lock: { status: 'locked' } }))).toBeNull();
    expect(slotRange(rangeInput({ lock: { status: 'partially_unlocked' } }))).toBeNull();
  });

  it('starts a slot that is not locked at the first history point', () => {
    expect(slotRange(rangeInput({ lock: { status: 'not_locked' } }))).toEqual({
      start: at(0),
      end: now,
      startKind: 'history_start',
    });
  });

  it('has no range without history for a slot that starts at the first history point', () => {
    expect(slotRange(rangeInput({ lock: { status: 'start_slot' }, firstHistoryTime: null }))).toBeNull();
  });

  it('starts a start slot at the first history point', () => {
    expect(slotRange(rangeInput({ lock: { status: 'start_slot' } }))).toEqual({
      start: at(0),
      end: now,
      startKind: 'history_start',
    });
  });

  it('starts a slot with the unlock time source unknown at the first history point', () => {
    expect(
      slotRange(rangeInput({ lock: { status: 'unlocked', unlockTime: null, unlockTimeSource: 'unknown' } })),
    ).toEqual({
      start: at(0),
      end: now,
      startKind: 'unknown',
    });
  });

  it('starts at the unlock time and marks an estimated unlock time', () => {
    expect(slotRange(rangeInput())).toEqual({ start: at(60), end: now, startKind: 'unlock' });
    expect(
      slotRange(rangeInput({ lock: { status: 'unlocked', unlockTime: at(60), unlockTimeSource: 'estimated' } })),
    ).toEqual({ start: at(60), end: now, startKind: 'estimated' });
  });

  it('ends at the goal time', () => {
    expect(slotRange(rangeInput({ goalReached: true, goalTime: at(300) }))).toEqual({
      start: at(60),
      end: at(300),
      startKind: 'unlock',
    });
  });

  it('has no range for a reached goal without goal time', () => {
    expect(slotRange(rangeInput({ goalReached: true, goalTime: null }))).toBeNull();
  });
});

describe('gamePaceValues', () => {
  it('weights the pace with the active time and gives the median of the slots with a pace', () => {
    expect(
      gamePaceValues([
        { activeMinutes: 60, checks: 30, checksPerHour: 30 },
        { activeMinutes: 120, checks: 120, checksPerHour: 60 },
        { activeMinutes: 60, checks: 90, checksPerHour: 90 },
        { activeMinutes: 20, checks: 40, checksPerHour: null },
        { activeMinutes: null, checks: null, checksPerHour: null },
      ]),
    ).toEqual({
      slotCount: 5,
      activeMinutes: 260,
      checks: 280,
      checksPerHour: 280 / (260 / 60),
      medianChecksPerHour: 60,
    });
  });

  it('gives the mean of the two middle values as median for an even number of slots', () => {
    expect(
      gamePaceValues([
        { activeMinutes: 60, checks: 30, checksPerHour: 30 },
        { activeMinutes: 60, checks: 60, checksPerHour: 60 },
      ]).medianChecksPerHour,
    ).toBe(45);
  });

  it('gives no pace without slots with a pace', () => {
    expect(gamePaceValues([{ activeMinutes: null, checks: null, checksPerHour: null }])).toEqual({
      slotCount: 1,
      activeMinutes: 0,
      checks: 0,
      checksPerHour: null,
      medianChecksPerHour: null,
    });
  });
});

describe('slotPaceRows', () => {
  const values = (row: SlotPaceRow) => ({
    player: row.discordUserId,
    from: row.from,
    to: row.to,
    activeMinutes: row.activeMinutes,
    checks: row.checks,
    bkMinutes: row.bkMinutes,
    bkCount: row.bkCount,
    longestBkMinutes: row.longestBkMinutes,
  });

  it('gives one row for a slot with one player', () => {
    expect(
      slotPaceRows(input({ history: history([0, 0], [10, 5], [20, 10]), range: range(0, 20) })).map(values),
    ).toEqual([
      {
        player: '1',
        from: at(0),
        to: at(20),
        activeMinutes: 20,
        checks: 10,
        bkMinutes: 0,
        bkCount: 0,
        longestBkMinutes: 0,
      },
    ]);
  });

  it('gives one row for each player of the slot', () => {
    const rows = slotPaceRows(
      input({
        history: history([0, 0], [10, 5], [20, 10], [30, 15], [40, 20]),
        range: range(0, 40),
        signals: signals({ playerPeriods: [player(-1000, 20, '1', 'alice'), player(20, 1000, '2', 'bob')] }),
      }),
    );
    expect(rows.map(values)).toEqual([
      {
        player: '1',
        from: at(0),
        to: at(20),
        activeMinutes: 20,
        checks: 10,
        bkMinutes: 0,
        bkCount: 0,
        longestBkMinutes: 0,
      },
      {
        player: '2',
        from: at(20),
        to: at(40),
        activeMinutes: 20,
        checks: 10,
        bkMinutes: 0,
        bkCount: 0,
        longestBkMinutes: 0,
      },
    ]);
    expect(rows.map((row) => row.discordName)).toEqual(['alice', 'bob']);
  });

  it('gives a row without player for the time without Discord user and keeps the name of Cheese', () => {
    const rows = slotPaceRows(
      input({
        history: history([0, 0], [10, 5], [20, 10], [30, 15]),
        range: range(0, 30),
        signals: signals({
          playerPeriods: [player(-1000, 10, '1', 'alice'), player(10, 20, null, 'carol'), player(20, 1000, null, null)],
        }),
      }),
    );
    expect(rows.map((row) => [row.discordUserId, row.discordName, row.checks])).toEqual([
      ['1', 'alice', 5],
      [null, 'carol', 5],
      [null, null, 5],
    ]);
  });

  it('gives the time before the first player period to the first player', () => {
    expect(
      slotPaceRows(
        input({
          history: history([0, 0], [10, 5], [20, 10]),
          range: range(0, 20),
          signals: signals({ signalsFrom: at(15), playerPeriods: [player(15, 1000, '1', 'alice')] }),
        }),
      ).map(values),
    ).toEqual([
      {
        player: '1',
        from: at(0),
        to: at(20),
        activeMinutes: 20,
        checks: 10,
        bkMinutes: 0,
        bkCount: 0,
        longestBkMinutes: 0,
      },
    ]);
  });

  it('gives only rows for player periods in the range of the slot', () => {
    const rows = slotPaceRows(
      input({
        history: history([0, 0], [10, 5], [20, 10], [30, 15], [40, 20]),
        range: range(0, 40),
        signals: signals({
          playerPeriods: [
            player(-1000, -50, '0', 'zoe'),
            player(-50, 20, '1', 'alice'),
            player(20, 60, '2', 'bob'),
            player(60, 1000, '3', 'carol'),
          ],
        }),
      }),
    );
    expect(rows.map((row) => [row.discordUserId, row.from, row.to])).toEqual([
      ['1', at(0), at(20)],
      ['2', at(20), at(40)],
    ]);
  });

  it('gives a step with checks at the change of the player completely to the new player', () => {
    expect(
      slotPaceRows(
        input({
          history: history([0, 0], [10, 5], [20, 10], [30, 15], [40, 115]),
          range: range(0, 40),
          signals: signals({
            playerPeriods: [
              player(-1000, 15, '1', 'alice'),
              player(15, 35, '2', 'bob'),
              player(35, 1000, '3', 'carol'),
            ],
          }),
        }),
      ).map((row) => [row.discordUserId, row.activeMinutes, row.checks]),
    ).toEqual([
      ['1', 10, 5],
      ['2', 20, 10],
      ['3', 0, 0],
    ]);
  });

  it('cuts a quiet period at the change of the player and keeps its kind', () => {
    expect(
      slotPaceRows(
        input({
          history: history([0, 0], [10, 5], [20, 5], [30, 5], [40, 5], [50, 9]),
          range: range(0, 50),
          signals: signals({ playerPeriods: [player(-1000, 25, '1', 'alice'), player(25, 1000, '2', 'bob')] }),
        }),
      ).map((row) => [row.discordUserId, row.activeMinutes, row.checks]),
    ).toEqual([
      ['1', 25, 5],
      ['2', 25, 4],
    ]);
  });

  it('divides the time of a BK period at the change of the player and counts it only in the row of its start', () => {
    expect(
      slotPaceRows(
        input({
          history: history([0, 0], [10, 5], [20, 5], [30, 5], [40, 5], [50, 9]),
          range: range(0, 50),
          signals: signals({
            progressionItemTimes: [at(45)],
            playerPeriods: [player(-1000, 25, '1', 'alice'), player(25, 1000, '2', 'bob')],
          }),
        }),
      ).map(values),
    ).toEqual([
      {
        player: '1',
        from: at(0),
        to: at(25),
        activeMinutes: 10,
        checks: 5,
        bkMinutes: 15,
        bkCount: 1,
        longestBkMinutes: 30,
      },
      {
        player: '2',
        from: at(25),
        to: at(50),
        activeMinutes: 10,
        checks: 4,
        bkMinutes: 15,
        bkCount: 0,
        longestBkMinutes: 0,
      },
    ]);
  });

  it('marks the start kind only in the row with the start of the slot and partial signals for each row', () => {
    expect(
      slotPaceRows(
        input({
          history: history([0, 0], [10, 5], [20, 10], [30, 15]),
          range: range(0, 30, 'estimated'),
          signals: signals({
            signalsFrom: at(15),
            playerPeriods: [player(15, 20, '1', 'alice'), player(20, 1000, '2', 'bob')],
          }),
        }),
      ).map((row) => [row.discordUserId, row.startKind, row.partialSignals]),
    ).toEqual([
      ['1', 'estimated', true],
      ['2', null, false],
    ]);
  });

  it('marks the start kind in the first shown row when the row with the start has no time', () => {
    expect(
      slotPaceRows(
        input({
          history: history([0, 0], [10, 5], [20, 10]),
          range: range(0, 20, 'estimated'),
          signals: signals({ playerPeriods: [player(-1000, 5, '1', 'alice'), player(5, 1000, '2', 'bob')] }),
        }),
      ).map((row) => [row.discordUserId, row.startKind]),
    ).toEqual([['2', 'estimated']]);
  });

  it('gives no row for a player without time', () => {
    expect(
      slotPaceRows(
        input({
          history: history([0, 0], [10, 5], [20, 10]),
          range: range(0, 20),
          signals: signals({
            playerPeriods: [
              player(-1000, 12, '1', 'alice'),
              player(12, 18, '2', 'bob'),
              player(18, 1000, '3', 'carol'),
            ],
          }),
        }),
      ).map((row) => [row.discordUserId, row.from, row.to, row.checks]),
    ).toEqual([
      ['1', at(0), at(12), 5],
      ['3', at(18), at(20), 5],
    ]);
    expect(
      slotPaceRows(
        input({
          history: history([0, 0], [10, 5], [20, 10]),
          range: range(0, 100),
          signals: signals({ playerPeriods: [player(-1000, 50, '1', 'alice'), player(50, 1000, '2', 'bob')] }),
        }),
      ).map((row) => row.discordUserId),
    ).toEqual(['1']);
  });

  it('counts a BK period with only bulk steps with 0 minutes', () => {
    const slot = input({
      history: history([0, 0], [10, 5], [20, 105], [30, 110]),
      range: range(0, 30),
      signals: signals({ progressionItemTimes: [at(25)] }),
    });
    expect(classifySlot(slot)).toEqual([
      segment('active', 0, 10, 5),
      segment('bulk', 10, 20, 100),
      segment('active', 20, 30, 5),
    ]);
    expect(onlyRow(slot)).toMatchObject({
      activeMinutes: 20,
      checks: 10,
      bkMinutes: 0,
      bkShare: 0,
      bkCount: 1,
      longestBkMinutes: 0,
    });
  });

  it('gives one row with the current player of the slot if the signals have no player periods', () => {
    expect(
      slotPaceRows(
        input({
          history: history([0, 0], [10, 5]),
          range: range(0, 10, 'estimated'),
          signals: signals({ signalsFrom: null, playerPeriods: [] }),
          currentPlayer: { discordUserId: '4', discordName: 'dave' },
        }),
      ).map((row) => [row.discordUserId, row.discordName, row.from, row.to, row.checks, row.startKind]),
    ).toEqual([['4', 'dave', at(0), at(10), 5, 'estimated']]);
  });
});
