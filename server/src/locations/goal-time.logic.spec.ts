import { nextGoalTime, type GoalTime, type GoalTimeSlot } from './goal-time.logic.js';

const now = new Date('2026-10-28T12:00:00Z');
const activity = new Date('2026-10-28T09:30:00Z');

const slot = (overrides: Partial<GoalTimeSlot> = {}): GoalTimeSlot => ({
  completionStatus: 'incomplete',
  archipelagoGoal: false,
  lastActivity: activity,
  ...overrides,
});

const stored = (overrides: Partial<GoalTimeSlot> = {}, goalTime: Partial<GoalTime> = {}): GoalTimeSlot & GoalTime => ({
  ...slot(overrides),
  goalTime: null,
  goalTimeSource: null,
  ...goalTime,
});

describe('nextGoalTime', () => {
  it('has no goal time for a slot without goal', () => {
    expect(nextGoalTime(stored(), slot(), now)).toEqual({ goalTime: null, goalTimeSource: null });
  });

  it('uses the time of the synchronization if the goal was seen there', () => {
    expect(nextGoalTime(stored(), slot({ completionStatus: 'goal' }), now)).toEqual({
      goalTime: now,
      goalTimeSource: 'sync',
    });
    expect(nextGoalTime(stored(), slot({ archipelagoGoal: true }), now)).toEqual({
      goalTime: now,
      goalTimeSource: 'sync',
    });
  });

  it('keeps a known goal time even if the activity changes later', () => {
    const goalTime = new Date('2026-10-27T20:00:00Z');
    expect(
      nextGoalTime(
        stored({ completionStatus: 'goal' }, { goalTime, goalTimeSource: 'sync' }),
        slot({ completionStatus: 'released', lastActivity: now }),
        now,
      ),
    ).toEqual({ goalTime, goalTimeSource: 'sync' });
  });

  it('estimates the goal time with the last Cheese activity if the goal was not seen', () => {
    expect(nextGoalTime(undefined, slot({ completionStatus: 'done' }), now)).toEqual({
      goalTime: activity,
      goalTimeSource: 'estimated',
    });
    expect(nextGoalTime(stored({ completionStatus: 'goal' }), slot({ completionStatus: 'goal' }), now)).toEqual({
      goalTime: activity,
      goalTimeSource: 'estimated',
    });
  });

  it('has no goal time if the goal was not seen and there is no Cheese activity', () => {
    expect(nextGoalTime(undefined, slot({ completionStatus: 'goal', lastActivity: null }), now)).toEqual({
      goalTime: null,
      goalTimeSource: null,
    });
  });

  it('removes the goal time if the slot has no goal any more', () => {
    expect(
      nextGoalTime(stored({ completionStatus: 'goal' }, { goalTime: now, goalTimeSource: 'sync' }), slot(), now),
    ).toEqual({ goalTime: null, goalTimeSource: null });
  });
});
