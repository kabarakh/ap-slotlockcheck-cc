import { parseProcessedSnapshotIds, removableBelowId, retentionCutoff } from './snapshot-retention.logic.js';

describe('removableBelowId', () => {
  it('keeps the latest snapshot of a source that pace does not read', () => {
    expect(removableBelowId('ap_slot_data', 40, {})).toBe(40);
  });

  it('keeps the pace snapshots that are not read yet', () => {
    expect(removableBelowId('ap_tracker', 40, { ap_tracker: 30 })).toBe(31);
  });

  it('keeps the latest pace snapshot when all snapshots are read', () => {
    expect(removableBelowId('cheese', 40, { cheese: 40 })).toBe(40);
  });

  it('keeps all pace snapshots without saved pace signals', () => {
    expect(removableBelowId('cheese', 40, {})).toBe(1);
  });
});

describe('parseProcessedSnapshotIds', () => {
  it('reads the saved snapshot ids', () => {
    expect(parseProcessedSnapshotIds('{"cheese":3,"ap_tracker":5}')).toEqual({ cheese: 3, ap_tracker: 5 });
  });

  it('gives no ids for missing or broken values', () => {
    expect(parseProcessedSnapshotIds(null)).toEqual({});
    expect(parseProcessedSnapshotIds('not json')).toEqual({});
    expect(parseProcessedSnapshotIds('{"cheese":"x"}')).toEqual({});
  });
});

describe('retentionCutoff', () => {
  it('goes back the given days', () => {
    expect(retentionCutoff(new Date('2026-11-15T12:00:00Z'), 14)).toEqual(new Date('2026-11-01T12:00:00Z'));
  });
});
