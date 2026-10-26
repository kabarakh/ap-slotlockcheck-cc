export const GOALED_COMPLETION_STATUSES = ['goal', 'done', 'released'];

export interface GoalFields {
  completionStatus: string;
  archipelagoGoal: boolean;
}

export function isGoaled(slot: GoalFields): boolean {
  return slot.archipelagoGoal || GOALED_COMPLETION_STATUSES.includes(slot.completionStatus);
}

export const notGoaledSlotFilter = {
  archipelagoGoal: false,
  completionStatus: { notIn: GOALED_COMPLETION_STATUSES },
};
