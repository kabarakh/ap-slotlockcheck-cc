import { roomNow, shouldAutoArchive } from './archive.logic.js';

const slot = (completionStatus: string, isSlotLock = false, archipelagoGoal = false) => ({
  completionStatus,
  archipelagoGoal,
  isSlotLock,
});

const active = { archivedAt: null, autoArchive: true };

describe('shouldAutoArchive', () => {
  it('archives when all playable slots are finished', () => {
    expect(shouldAutoArchive(active, [slot('goal'), slot('released'), slot('incomplete', false, true)])).toBe(true);
  });

  it('does not archive while one playable slot is not finished', () => {
    expect(shouldAutoArchive(active, [slot('goal'), slot('all_checks')])).toBe(false);
  });

  it('ignores SlotLock slots', () => {
    expect(shouldAutoArchive(active, [slot('goal'), slot('incomplete', true)])).toBe(true);
  });

  it('does not archive a room without playable slots', () => {
    expect(shouldAutoArchive(active, [slot('incomplete', true)])).toBe(false);
    expect(shouldAutoArchive(active, [])).toBe(false);
  });

  it('does not archive when the automatic archive is off or the room is archived', () => {
    expect(shouldAutoArchive({ archivedAt: null, autoArchive: false }, [slot('goal')])).toBe(false);
    expect(shouldAutoArchive({ archivedAt: new Date(), autoArchive: true }, [slot('goal')])).toBe(false);
  });
});

describe('roomNow', () => {
  it('uses the archive time of an archived room', () => {
    const archivedAt = new Date('2026-10-01T00:00:00Z');
    const now = new Date('2026-10-28T00:00:00Z');
    expect(roomNow({ archivedAt }, now)).toBe(archivedAt);
    expect(roomNow({ archivedAt: null }, now)).toBe(now);
  });
});
