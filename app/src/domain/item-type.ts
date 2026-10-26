import type { ItemType } from '@/api/types';

export const ITEM_TYPES: ItemType[] = ['progression', 'useful', 'normal', 'trap'];

export const FILLER_TYPES: ItemType[] = ['useful', 'normal', 'trap'];

export type TagSeverity = 'success' | 'info' | 'secondary' | 'danger';

export const ITEM_TYPE_SEVERITY: Record<ItemType, TagSeverity> = {
  progression: 'success',
  useful: 'info',
  normal: 'secondary',
  trap: 'danger',
};
