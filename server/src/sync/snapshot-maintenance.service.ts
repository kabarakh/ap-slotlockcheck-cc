import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { AppConfigService } from '../config/app-config.service.js';
import { PaceSignalsService } from '../pace/pace-signals.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { compressSnapshotPayload } from './snapshot-payload.js';
import { parseProcessedSnapshotIds, removableBelowId, retentionCutoff } from './snapshot-retention.logic.js';

const MAINTENANCE_INTERVAL_MS = 6 * 60 * 60_000;
const COMPRESSION_BATCH_SIZE = 10;

export interface MaintenanceResult {
  removedSnapshots: number;
  removedSyncRuns: number;
  compressedSnapshots: number;
}

@Injectable()
export class SnapshotMaintenanceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SnapshotMaintenanceService.name);
  private running: Promise<MaintenanceResult> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly paceSignals: PaceSignalsService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.isTest) {
      void this.scheduledMaintenance();
    }
  }

  @Interval(MAINTENANCE_INTERVAL_MS)
  async scheduledMaintenance(): Promise<void> {
    if (this.config.isTest) {
      return;
    }
    try {
      await this.maintain();
    } catch (error) {
      this.logger.error(`Snapshot maintenance failed: ${String(error)}`);
    }
  }

  async maintain(now = new Date()): Promise<MaintenanceResult> {
    this.running ??= this.run(now).finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(now: Date): Promise<MaintenanceResult> {
    const { removedSnapshots, removedSyncRuns } = await this.removeOld(now);
    const compressedSnapshots = await this.compressRemaining();
    const releasedPages = this.prisma.releaseFreePages();
    if (removedSnapshots + removedSyncRuns + compressedSnapshots + releasedPages > 0) {
      this.logger.log(
        `Removed ${removedSnapshots} snapshots and ${removedSyncRuns} synchronization runs, compressed ${compressedSnapshots} snapshots, released ${releasedPages} free pages`,
      );
    }
    return { removedSnapshots, removedSyncRuns, compressedSnapshots };
  }

  private async removeOld(now: Date): Promise<Omit<MaintenanceResult, 'compressedSnapshots'>> {
    const cutoff = retentionCutoff(now, this.config.get('SNAPSHOT_RETENTION_DAYS'));
    const rooms = await this.prisma.room.findMany({
      select: { id: true, slug: true, archivedAt: true, paceSignalState: { select: { lastSnapshotIds: true } } },
    });
    let removedSnapshots = 0;
    let removedSyncRuns = 0;
    for (const room of rooms) {
      if (room.archivedAt !== null) {
        const removed = await this.removeArchived(room, now);
        removedSnapshots += removed.removedSnapshots;
        removedSyncRuns += removed.removedSyncRuns;
        continue;
      }
      const processedIds = parseProcessedSnapshotIds(room.paceSignalState?.lastSnapshotIds);
      const latest = await this.prisma.syncSnapshot.groupBy({
        by: ['source'],
        where: { roomId: room.id },
        _max: { id: true },
      });
      let removedInRoom = 0;
      for (const { source, _max } of latest) {
        const { count } = await this.prisma.syncSnapshot.deleteMany({
          where: {
            roomId: room.id,
            source,
            id: { lt: removableBelowId(source, _max.id ?? 0, processedIds) },
            createdAt: { lt: cutoff },
          },
        });
        removedInRoom += count;
      }
      if (removedInRoom > 0) {
        await this.prisma.room.update({ where: { id: room.id }, data: { snapshotsPrunedAt: now } });
      }
      removedSnapshots += removedInRoom;
      removedSyncRuns += await this.removeOldSyncRuns(room.id, cutoff);
    }
    return { removedSnapshots, removedSyncRuns };
  }

  private async removeArchived(
    room: { id: number; slug: string },
    now: Date,
  ): Promise<Omit<MaintenanceResult, 'compressedSnapshots'>> {
    try {
      await this.paceSignals.updateSignals(room);
    } catch (error) {
      this.logger.warn(
        `Snapshots of the archived room ${room.slug} are kept, pace signals not updated: ${String(error)}`,
      );
      return { removedSnapshots: 0, removedSyncRuns: 0 };
    }
    const snapshots = await this.prisma.syncSnapshot.deleteMany({ where: { roomId: room.id } });
    const syncRuns = await this.prisma.syncRun.deleteMany({ where: { roomId: room.id, result: { not: 'running' } } });
    if (snapshots.count > 0) {
      await this.prisma.room.update({ where: { id: room.id }, data: { snapshotsPrunedAt: now } });
    }
    return { removedSnapshots: snapshots.count, removedSyncRuns: syncRuns.count };
  }

  private async removeOldSyncRuns(roomId: number, cutoff: Date): Promise<number> {
    const used = await this.prisma.syncSnapshot.findMany({
      where: { roomId },
      select: { firstSyncRunId: true },
      distinct: ['firstSyncRunId'],
    });
    const { count } = await this.prisma.syncRun.deleteMany({
      where: {
        roomId,
        startedAt: { lt: cutoff },
        result: { not: 'running' },
        id: { notIn: used.map((snapshot) => snapshot.firstSyncRunId) },
      },
    });
    return count;
  }

  private async compressRemaining(): Promise<number> {
    let compressed = 0;
    for (;;) {
      const rows = await this.prisma.syncSnapshot.findMany({
        where: { payload: { not: null } },
        select: { id: true, payload: true },
        orderBy: { id: 'asc' },
        take: COMPRESSION_BATCH_SIZE,
      });
      if (rows.length === 0) {
        return compressed;
      }
      for (const row of rows) {
        const compressedPayload = await compressSnapshotPayload(row.payload ?? '');
        await this.prisma.syncSnapshot.updateMany({
          where: { id: row.id, payload: row.payload },
          data: { compressedPayload, payload: null },
        });
        compressed += 1;
      }
    }
  }
}
