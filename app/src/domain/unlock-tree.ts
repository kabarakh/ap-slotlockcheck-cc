import type { LockStatus, SlotLock, SlotRow } from '@/api/types';
import { isGoaled } from './summary';

export type UnlockTreeNodeKind = 'slotlock' | 'start' | 'unlocked' | 'partial';

export interface UnlockTreeNode {
  id: number;
  name: string;
  game: string;
  discordName: string | null;
  kind: UnlockTreeNodeKind;
  lockStatus: LockStatus;
  goaled: boolean;
  unlockTime: string | null;
  children: UnlockTreeNode[];
}

export interface UnlockForest {
  roots: UnlockTreeNode[];
  lockedSlotCount: number;
}

function completingLock(locks: SlotLock[]): SlotLock | undefined {
  const unlocked = locks.filter((lock) => lock.unlocked);
  return unlocked.reduce<SlotLock | undefined>((latest, lock) => {
    if (!latest) {
      return lock;
    }
    const latestTime = latest.unlockTime ? new Date(latest.unlockTime).getTime() : -Infinity;
    const lockTime = lock.unlockTime ? new Date(lock.unlockTime).getTime() : -Infinity;
    return lockTime > latestTime ? lock : latest;
  }, undefined);
}

function nodeKind(slot: SlotRow): UnlockTreeNodeKind | undefined {
  if (slot.isSelectedSlotLock) {
    return 'slotlock';
  }
  switch (slot.lockStatus) {
    case 'start_slot':
      return 'start';
    case 'unlocked':
      return 'unlocked';
    case 'partially_unlocked':
      return 'partial';
    default:
      return undefined;
  }
}

function sortTree(nodes: UnlockTreeNode[]): UnlockTreeNode[] {
  return nodes
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((node) => ({ ...node, children: sortTree(node.children) }));
}

export function buildUnlockForest(slots: SlotRow[]): UnlockForest {
  const lockers = slots.filter((slot) => slot.isSelectedSlotLock).sort((a, b) => a.position - b.position);
  const defaultRootId = lockers[0]?.id;
  const nodes = new Map<number, UnlockTreeNode>();
  const parentIds = new Map<number, number>();

  for (const slot of slots) {
    const kind = nodeKind(slot);
    if (!kind) {
      continue;
    }
    nodes.set(slot.id, {
      id: slot.id,
      name: slot.name,
      game: slot.game,
      discordName: slot.discordName,
      kind,
      lockStatus: slot.lockStatus,
      goaled: isGoaled(slot),
      unlockTime: slot.unlockTime,
      children: [],
    });
    if (kind === 'start' && defaultRootId !== undefined) {
      parentIds.set(slot.id, defaultRootId);
    }
    if (kind === 'unlocked' || kind === 'partial') {
      const lock = completingLock(slot.locks);
      const parentId = lock?.senderSlotId ?? lock?.lockerSlotId ?? defaultRootId;
      if (parentId !== undefined) {
        parentIds.set(slot.id, parentId);
      }
    }
  }

  const leadsToCycle = (childId: number, parentId: number): boolean => {
    let current: number | undefined = parentId;
    const seen = new Set<number>();
    while (current !== undefined && !seen.has(current)) {
      if (current === childId) {
        return true;
      }
      seen.add(current);
      current = parentIds.get(current);
    }
    return false;
  };

  const roots: UnlockTreeNode[] = [];
  for (const node of nodes.values()) {
    const parentId = parentIds.get(node.id);
    const parent = parentId === undefined ? undefined : nodes.get(parentId);
    if (parent && parentId !== undefined && !leadsToCycle(node.id, parentId)) {
      parent.children.push(node);
    } else if (node.kind === 'slotlock') {
      roots.push(node);
    } else {
      parentIds.delete(node.id);
      const root = defaultRootId === undefined ? undefined : nodes.get(defaultRootId);
      if (root && root !== node) {
        root.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return {
    roots: sortTree(roots),
    lockedSlotCount: slots.filter((slot) => slot.lockStatus === 'locked').length,
  };
}
