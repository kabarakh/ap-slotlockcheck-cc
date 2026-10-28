import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import type { Room } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  emptySignalsState,
  parseSignalsState,
  readSignalSnapshot,
  serializeSignalsState,
  type SignalPeriod,
  type SignalSource,
  type SignalsState,
} from './pace-signals.js';
import { SNAPSHOT_BATCH_SIZE } from './pace.constants.js';
import { orderSnapshots, type OrderedSnapshot, type SnapshotEntry } from './pace.mapper.js';

export interface UnreadableSnapshot {
  source: SignalSource;
  from: Date;
  to: Date | null;
}

export type LastSnapshotIds = Record<SignalSource, number>;

export interface StoredSignals {
  state: SignalsState;
  lastSnapshotIds: LastSnapshotIds;
  unreadableSnapshots: UnreadableSnapshot[];
}

type SignalsRoom = Pick<Room, 'id' | 'slug'>;

const SIGNAL_SOURCES: SignalSource[] = ['cheese', 'ap_tracker'];
const sourceSchema = z.enum(['cheese', 'ap_tracker']);
const isoDate = z.iso.datetime().transform((value) => new Date(value));
const lastSnapshotIdsSchema = z.object({ cheese: z.number().int(), ap_tracker: z.number().int() });
const unreadableSnapshotsSchema = z.array(z.object({ source: sourceSchema, from: isoDate, to: isoDate.nullable() }));

const emptyStoredSignals = (): StoredSignals => ({
  state: emptySignalsState(),
  lastSnapshotIds: { cheese: 0, ap_tracker: 0 },
  unreadableSnapshots: [],
});

export function unreadablePeriods(snapshots: UnreadableSnapshot[], now: Date): SignalPeriod[] {
  return snapshots
    .map((snapshot) => ({ from: snapshot.from, to: snapshot.to ?? now }))
    .sort((a, b) => a.from.getTime() - b.from.getTime());
}

function lastReadFrom(stored: StoredSignals, source: SignalSource): Date | undefined {
  return (
    stored.unreadableSnapshots.find((snapshot) => snapshot.source === source && snapshot.to === null)?.from ??
    stored.state.lastValidFrom.get(source)
  );
}

function isAfterLastRead(stored: StoredSignals, snapshots: OrderedSnapshot[]): boolean {
  return snapshots.every((snapshot) => {
    const last = lastReadFrom(stored, snapshot.source);
    return last === undefined || snapshot.from >= last;
  });
}

@Injectable()
export class PaceSignalsService {
  private readonly logger = new Logger(PaceSignalsService.name);
  private readonly updates = new Map<number, Promise<StoredSignals>>();

  constructor(private readonly prisma: PrismaService) {}

  async updateSignals(room: SignalsRoom): Promise<StoredSignals> {
    const previous = this.updates.get(room.id) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => this.update(room));
    this.updates.set(room.id, next);
    try {
      return await next;
    } finally {
      if (this.updates.get(room.id) === next) {
        this.updates.delete(room.id);
      }
    }
  }

  private async update(room: SignalsRoom): Promise<StoredSignals> {
    const saved = await this.load(room);
    let stored = saved ?? emptyStoredSignals();
    let entries = await this.newEntries(room.id, stored.lastSnapshotIds);
    let { snapshots, withoutRun } = await this.order(room.id, entries);
    if (!isAfterLastRead(stored, snapshots)) {
      this.logger.warn(`New snapshots of room ${room.slug} are older than the saved pace signals, read all again`);
      stored = emptyStoredSignals();
      entries = await this.newEntries(room.id, stored.lastSnapshotIds);
      ({ snapshots, withoutRun } = await this.order(room.id, entries));
    }
    if (saved !== null && entries.length === 0) {
      return stored;
    }
    for (const id of withoutRun) {
      this.logger.warn(`Snapshot ${id} of room ${room.slug} has no synchronization run and is not used`);
    }
    await this.read(room, stored, snapshots);
    for (const entry of entries) {
      stored.lastSnapshotIds[entry.source] = Math.max(stored.lastSnapshotIds[entry.source], entry.id);
    }
    const data = {
      state: serializeSignalsState(stored.state),
      lastSnapshotIds: JSON.stringify(stored.lastSnapshotIds),
      unreadableSnapshots: JSON.stringify(stored.unreadableSnapshots),
    };
    await this.prisma.paceSignalState.upsert({
      where: { roomId: room.id },
      create: { roomId: room.id, ...data },
      update: data,
    });
    return stored;
  }

  private async load(room: SignalsRoom): Promise<StoredSignals | null> {
    const row = await this.prisma.paceSignalState.findUnique({ where: { roomId: room.id } });
    if (row === null) {
      return null;
    }
    try {
      return {
        state: parseSignalsState(row.state),
        lastSnapshotIds: lastSnapshotIdsSchema.parse(JSON.parse(row.lastSnapshotIds)),
        unreadableSnapshots: unreadableSnapshotsSchema.parse(JSON.parse(row.unreadableSnapshots)),
      };
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        this.logger.warn(`Saved pace signals of room ${room.slug} cannot be read, read all again: ${error.message}`);
        return null;
      }
      throw error;
    }
  }

  private async newEntries(roomId: number, lastSnapshotIds: LastSnapshotIds): Promise<SnapshotEntry[]> {
    const entries = await this.prisma.syncSnapshot.findMany({
      where: {
        roomId,
        OR: SIGNAL_SOURCES.map((source) => ({ source, id: { gt: lastSnapshotIds[source] } })),
      },
      select: { id: true, source: true, firstSyncRunId: true },
    });
    return entries as SnapshotEntry[];
  }

  private async order(roomId: number, entries: SnapshotEntry[]) {
    const runs = await this.prisma.syncRun.findMany({
      where: { roomId, id: { in: [...new Set(entries.map((entry) => entry.firstSyncRunId))] } },
      select: { id: true, startedAt: true },
    });
    return orderSnapshots(entries, new Map(runs.map((run) => [run.id, run.startedAt])), new Date());
  }

  private async read(room: SignalsRoom, stored: StoredSignals, snapshots: OrderedSnapshot[]): Promise<void> {
    for (let start = 0; start < snapshots.length; start += SNAPSHOT_BATCH_SIZE) {
      const batch = snapshots.slice(start, start + SNAPSHOT_BATCH_SIZE);
      const payloads = new Map(
        (
          await this.prisma.syncSnapshot.findMany({
            where: { id: { in: batch.map((snapshot) => snapshot.id) } },
            select: { id: true, payload: true },
          })
        ).map((row) => [row.id, row.payload]),
      );
      for (const snapshot of batch) {
        for (const open of stored.unreadableSnapshots) {
          if (open.source === snapshot.source && open.to === null) {
            open.to = snapshot.from;
          }
        }
        const result = readSignalSnapshot(stored.state, {
          source: snapshot.source,
          validFrom: snapshot.from,
          payload: payloads.get(snapshot.id) ?? '',
        });
        if (!result.read) {
          this.logger.warn(
            `Snapshot ${snapshot.id} of room ${room.slug} cannot be read and is not used: ${result.error.message}`,
          );
          stored.unreadableSnapshots.push({ source: snapshot.source, from: snapshot.from, to: null });
        }
        payloads.delete(snapshot.id);
      }
    }
  }
}
