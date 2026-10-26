import { describe, expect, it } from 'vitest';

import type { SlotLock } from '@/api/types';
import { buildUnlockForest, type UnlockTreeNode } from '../unlock-tree';
import { slotRow } from './fixtures';

const lock = (lockerSlotId: number, senderSlotId: number | null, unlockTime: string | null): SlotLock => ({
  lockerSlotId,
  lockerName: 'Locker',
  unlocked: true,
  senderSlotId,
  senderName: null,
  unlockTime,
  timeSource: unlockTime ? 'sync' : 'unknown',
});

const names = (nodes: UnlockTreeNode[]): unknown[] =>
  nodes.map((node) => (node.children.length > 0 ? [node.name, names(node.children)] : node.name));

describe('buildUnlockForest', () => {
  const slots = [
    slotRow({ id: 1, name: 'Locker', isSlotLock: true, isSelectedSlotLock: true }),
    slotRow({ id: 2, name: 'Start', lockStatus: 'start_slot', completionStatus: 'goal' }),
    slotRow({ id: 3, name: 'B', lockStatus: 'unlocked', locks: [lock(1, 2, '2026-10-20T10:00:00Z')] }),
    slotRow({ id: 4, name: 'C', lockStatus: 'unlocked', locks: [lock(1, 3, null)] }),
    slotRow({ id: 5, name: 'D', lockStatus: 'unlocked', locks: [lock(1, null, null)] }),
    slotRow({ id: 6, name: 'E', lockStatus: 'locked' }),
  ];

  it('builds the tree from the senders of the unlock items', () => {
    const forest = buildUnlockForest(slots);
    expect(names(forest.roots)).toEqual([['Locker', ['D', ['Start', [['B', ['C']]]]]]]);
    expect(forest.lockedSlotCount).toBe(1);
  });

  it('marks goaled slots and the node kinds', () => {
    const root = buildUnlockForest(slots).roots[0];
    const start = root?.children.find((node) => node.name === 'Start');
    expect(root?.kind).toBe('slotlock');
    expect(start).toMatchObject({ kind: 'start', goaled: true });
  });

  it('uses the sender of the last necessary unlock item', () => {
    const forest = buildUnlockForest([
      ...slots.slice(0, 3),
      slotRow({
        id: 7,
        name: 'F',
        lockStatus: 'unlocked',
        locks: [lock(1, 2, '2026-10-20T10:00:00Z'), lock(8, 3, '2026-10-21T10:00:00Z')],
      }),
    ]);
    expect(names(forest.roots)).toEqual([['Locker', [['Start', [['B', ['F']]]]]]]);
  });

  it('breaks cycles and keeps all unlocked slots in the tree', () => {
    const forest = buildUnlockForest([
      slots[0]!,
      slotRow({ id: 3, name: 'B', lockStatus: 'unlocked', locks: [lock(1, 4, null)] }),
      slotRow({ id: 4, name: 'C', lockStatus: 'unlocked', locks: [lock(1, 3, null)] }),
    ]);
    expect(names(forest.roots)).toEqual([['Locker', [['B', ['C']]]]]);
  });
});
