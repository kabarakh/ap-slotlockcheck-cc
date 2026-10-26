export const ITEM_TYPES = ['progression', 'useful', 'normal', 'trap'] as const;

export type ItemType = (typeof ITEM_TYPES)[number];

const PROGRESSION_FLAG = 0b001;
const USEFUL_FLAG = 0b010;
const TRAP_FLAG = 0b100;

export function itemTypeFromFlags(flags: number): ItemType {
  if ((flags & PROGRESSION_FLAG) !== 0) {
    return 'progression';
  }
  if ((flags & USEFUL_FLAG) !== 0) {
    return 'useful';
  }
  if ((flags & TRAP_FLAG) !== 0) {
    return 'trap';
  }
  return 'normal';
}
