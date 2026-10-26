import { Controller, HttpCode, HttpException, HttpStatus, Param, Post } from '@nestjs/common';

import { RequireRoomRole } from '../auth/auth.decorators.js';
import { AppConfigService } from '../config/app-config.service.js';
import { SyncStatusDto } from '../rooms/dto/room.dto.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { SyncService } from './sync.service.js';

export function manualSyncWaitSeconds(lastSyncAt: Date | null, now: Date, cooldownSeconds: number): number {
  if (lastSyncAt === null) {
    return 0;
  }
  const elapsedSeconds = (now.getTime() - lastSyncAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(cooldownSeconds - elapsedSeconds));
}

@Controller('rooms/:slug/sync')
export class SyncController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly sync: SyncService,
    private readonly config: AppConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  @RequireRoomRole('admin')
  async synchronizeNow(@Param('slug') slug: string): Promise<SyncStatusDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const waitSeconds = manualSyncWaitSeconds(
      room.lastSyncAt,
      new Date(),
      this.config.get('MANUAL_SYNC_COOLDOWN_SECONDS'),
    );
    if (waitSeconds > 0 || this.rooms.isSyncRunning(room.id)) {
      throw new HttpException({ message: 'SYNC_TOO_EARLY', waitSeconds }, HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.sync.syncRoom(room.id, 'manual');
    return this.rooms.toSyncStatus(await this.rooms.findRoomBySlug(slug));
  }
}
