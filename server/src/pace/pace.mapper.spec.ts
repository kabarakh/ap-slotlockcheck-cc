import type { ChecksHistoryPoint } from '../lock/unlock-time.logic.js';
import type { SlotPaceDto } from './dto/pace.dto.js';
import type { SlotPaceRow } from './pace.logic.js';
import {
  firstHistoryTime,
  gamePaceDtos,
  orderSnapshots,
  pacedSlots,
  slotHistory,
  slotPaceDtos,
  slotRangeLock,
  type PaceSlot,
} from './pace.mapper.js';

const t = (time: string) => new Date(`2026-10-20T${time}:00Z`);

const slot: PaceSlot = { id: 7, name: 'Alice', game: 'Celeste', discordUserId: '42', discordName: 'alice' };

const row = (values: Partial<SlotPaceRow> = {}): SlotPaceRow => ({
  discordUserId: '43',
  discordName: 'bob',
  from: t('10:00'),
  to: t('11:00'),
  activeMinutes: 60,
  checks: 30,
  checksPerHour: 30,
  minutesPerCheck: 2,
  bkMinutes: 0,
  bkShare: 0,
  bkCount: 0,
  longestBkMinutes: 0,
  breakMinutes: 0,
  startKind: 'unlock',
  partialSignals: false,
  ...values,
});

describe('pace mapping', () => {
  it('maps the lock states to the input of the time range', () => {
    expect(slotRangeLock(undefined)).toEqual({ status: 'not_locked' });
    for (const status of ['not_locked', 'start_slot', 'locked', 'partially_unlocked'] as const) {
      expect(slotRangeLock({ status, unlockTime: null, unlockTimeSource: null })).toEqual({ status });
    }
    expect(slotRangeLock({ status: 'unlocked', unlockTime: t('10:00'), unlockTimeSource: 'estimated' })).toEqual({
      status: 'unlocked',
      unlockTime: t('10:00'),
      unlockTimeSource: 'estimated',
    });
    expect(slotRangeLock({ status: 'unlocked', unlockTime: null, unlockTimeSource: 'unknown' })).toEqual({
      status: 'unlocked',
      unlockTime: null,
      unlockTimeSource: 'unknown',
    });
    expect(slotRangeLock({ status: 'unlocked', unlockTime: t('10:00'), unlockTimeSource: 'unknown' })).toEqual({
      status: 'unlocked',
      unlockTime: null,
      unlockTimeSource: 'unknown',
    });
  });

  it('gives the first point of the checks history and the points of one slot', () => {
    const history: ChecksHistoryPoint[] = [
      { time: t('10:10'), checksBySlotKey: { '101': 1, '102': 4 } },
      { time: t('10:00'), checksBySlotKey: { '101': 0 } },
    ];
    expect(firstHistoryTime(history)).toEqual(t('10:00'));
    expect(firstHistoryTime([])).toBeNull();
    expect(slotHistory(history, 101)).toEqual([
      { time: t('10:10'), checks: 1 },
      { time: t('10:00'), checks: 0 },
    ]);
    expect(slotHistory(history, 102)).toEqual([{ time: t('10:10'), checks: 4 }]);
  });

  it('orders the snapshots by the start of their first synchronization and gives their validity', () => {
    const runStarts = new Map([
      [1, t('10:00')],
      [2, t('10:05')],
      [3, t('10:10')],
    ]);
    const order = orderSnapshots(
      [
        { id: 5, source: 'cheese', firstSyncRunId: 3 },
        { id: 1, source: 'cheese', firstSyncRunId: 1 },
        { id: 2, source: 'ap_tracker', firstSyncRunId: 1 },
        { id: 4, source: 'ap_tracker', firstSyncRunId: 2 },
        { id: 3, source: 'cheese', firstSyncRunId: 9 },
      ],
      runStarts,
      t('12:00'),
    );
    expect(order.withoutRun).toEqual([3]);
    expect(order.snapshots).toEqual([
      { id: 1, source: 'cheese', from: t('10:00'), to: t('10:10') },
      { id: 2, source: 'ap_tracker', from: t('10:00'), to: t('10:05') },
      { id: 4, source: 'ap_tracker', from: t('10:05'), to: t('12:00') },
      { id: 5, source: 'cheese', from: t('10:10'), to: t('12:00') },
    ]);
  });

  it('leaves out the SlotLock slots', () => {
    const lockers = [
      { ...slot, id: 1, game: 'SlotLock', isSlotLock: true },
      { ...slot, id: 2, isSlotLock: false },
      { ...slot, id: 3, game: 'SlotLock', isSlotLock: true },
    ];
    const paced = pacedSlots(lockers);
    expect(paced.map((candidate) => candidate.id)).toEqual([2]);
    expect(gamePaceDtos(paced, []).map((game) => game.game)).toEqual(['Celeste']);
    expect(gamePaceDtos(pacedSlots([{ game: 'SlotLock', isSlotLock: true }]), [])).toEqual([]);
  });

  it('gives one row without values for a slot without rows', () => {
    expect(slotPaceDtos(slot, [])).toEqual([
      {
        slotId: 7,
        name: 'Alice',
        game: 'Celeste',
        hasRange: false,
        discordUserId: '42',
        discordName: 'alice',
        from: null,
        to: null,
        activeMinutes: null,
        checks: null,
        checksPerHour: null,
        minutesPerCheck: null,
        bkMinutes: null,
        bkShare: null,
        bkCount: null,
        longestBkMinutes: null,
        breakMinutes: null,
        startKind: null,
        partialSignals: false,
      },
    ]);
  });

  it('gives one row for each player row with ISO times', () => {
    const rows = slotPaceDtos(slot, [row(), row({ from: t('11:00'), to: t('12:00'), startKind: null })]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      slotId: 7,
      hasRange: true,
      discordUserId: '43',
      discordName: 'bob',
      from: '2026-10-20T10:00:00.000Z',
      to: '2026-10-20T11:00:00.000Z',
      checksPerHour: 30,
      startKind: 'unlock',
    });
    expect(rows[1]).toMatchObject({ from: '2026-10-20T11:00:00.000Z', startKind: null });
  });

  it('gives one line for each game and counts only the rows with a time range', () => {
    const rows: SlotPaceDto[] = [
      ...slotPaceDtos({ ...slot, game: 'Celeste' }, [row({ activeMinutes: 60, checks: 30, checksPerHour: 30 })]),
      ...slotPaceDtos({ ...slot, game: 'Celeste' }, [row({ activeMinutes: 20, checks: 30, checksPerHour: null })]),
      ...slotPaceDtos({ ...slot, game: 'Celeste' }, []),
      ...slotPaceDtos({ ...slot, game: 'Factorio' }, []),
    ];
    expect(gamePaceDtos([{ game: 'Factorio' }, { game: 'Celeste' }, { game: 'Celeste' }], rows)).toEqual([
      { game: 'Celeste', slotCount: 2, activeMinutes: 80, checks: 60, checksPerHour: 45, medianChecksPerHour: 30 },
      {
        game: 'Factorio',
        slotCount: 0,
        activeMinutes: 0,
        checks: 0,
        checksPerHour: null,
        medianChecksPerHour: null,
      },
    ]);
  });
});
