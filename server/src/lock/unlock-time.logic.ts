import type { UnlockTimeSource } from './lock.types.js';

export interface ChecksHistoryPoint {
  time: Date;
  checksBySlotKey: Record<string, number>;
}

const SOURCE_RANK: Record<UnlockTimeSource, number> = {
  unknown: 0,
  estimated: 1,
  sync: 2,
  csv: 3,
  manual: 3,
};

export function estimateUnlockTime(history: ChecksHistoryPoint[], slotKey: string): Date | undefined {
  const points = [...history].sort((a, b) => a.time.getTime() - b.time.getTime());
  let previous: number | undefined;
  for (const point of points) {
    const checks = point.checksBySlotKey[slotKey];
    if (checks === undefined) {
      continue;
    }
    if ((previous === undefined && checks > 0) || (previous !== undefined && checks > previous)) {
      return point.time;
    }
    previous = checks;
  }
  return undefined;
}

export function canReplaceUnlockTime(current: UnlockTimeSource, candidate: UnlockTimeSource): boolean {
  if (candidate === 'manual' || candidate === 'csv') {
    return true;
  }
  return SOURCE_RANK[candidate] > SOURCE_RANK[current];
}
