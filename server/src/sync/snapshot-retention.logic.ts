import { z } from 'zod';

const PACE_SOURCES: ReadonlySet<string> = new Set(['cheese', 'ap_tracker']);
const MS_PER_DAY = 86_400_000;

const processedIdsSchema = z.record(z.string(), z.number().int());

export type ProcessedSnapshotIds = Record<string, number>;

export function parseProcessedSnapshotIds(json: string | null | undefined): ProcessedSnapshotIds {
  if (json === null || json === undefined) {
    return {};
  }
  try {
    return processedIdsSchema.parse(JSON.parse(json));
  } catch {
    return {};
  }
}

export function retentionCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * MS_PER_DAY);
}

export function removableBelowId(source: string, latestId: number, processedIds: ProcessedSnapshotIds): number {
  if (!PACE_SOURCES.has(source)) {
    return latestId;
  }
  return Math.min(latestId, (processedIds[source] ?? 0) + 1);
}
