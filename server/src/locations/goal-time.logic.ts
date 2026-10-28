import { isGoaled, type GoalFields } from './goal.logic.js';

export type GoalTimeSource = 'sync' | 'estimated';

export interface GoalTime {
  goalTime: Date | null;
  goalTimeSource: GoalTimeSource | null;
}

export interface GoalTimeSlot extends GoalFields {
  lastActivity: Date | null;
}

const NO_GOAL_TIME: GoalTime = { goalTime: null, goalTimeSource: null };

export function nextGoalTime(
  previous: (GoalTimeSlot & GoalTime) | undefined,
  current: GoalTimeSlot,
  now: Date,
): GoalTime {
  if (!isGoaled(current)) {
    return NO_GOAL_TIME;
  }
  if (previous?.goalTime) {
    return { goalTime: previous.goalTime, goalTimeSource: previous.goalTimeSource };
  }
  if (previous !== undefined && !isGoaled(previous)) {
    return { goalTime: now, goalTimeSource: 'sync' };
  }
  return current.lastActivity === null ? NO_GOAL_TIME : { goalTime: current.lastActivity, goalTimeSource: 'estimated' };
}
