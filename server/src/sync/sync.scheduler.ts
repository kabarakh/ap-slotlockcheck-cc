import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SyncService } from './sync.service.js';

const CHECK_INTERVAL_MS = 60_000;

export function isSyncDue(lastSyncAt: Date | null, now: Date, intervalMinutes: number): boolean {
  return lastSyncAt === null || now.getTime() - lastSyncAt.getTime() >= intervalMinutes * 60_000;
}

@Injectable()
export class SyncScheduler {
  private readonly logger = new Logger(SyncScheduler.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: SyncService,
    private readonly config: AppConfigService,
  ) {}

  @Interval(CHECK_INTERVAL_MS)
  async syncDueRooms(): Promise<void> {
    if (this.running || this.config.isTest) {
      return;
    }
    this.running = true;
    try {
      const now = new Date();
      const rooms = await this.prisma.room.findMany({ select: { id: true, slug: true, lastSyncAt: true } });
      for (const room of rooms) {
        if (isSyncDue(room.lastSyncAt, now, this.config.get('SYNC_INTERVAL_MINUTES'))) {
          await this.sync.syncRoom(room.id, 'schedule');
        }
      }
    } catch (error) {
      this.logger.error(`Scheduled synchronization failed: ${String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
