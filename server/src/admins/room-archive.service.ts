import { ConflictException, Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import type { RoomDetailDto } from '../rooms/dto/room.dto.js';
import { RoomUpdatesService } from '../rooms/room-updates.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { SyncService } from '../sync/sync.service.js';

@Injectable()
export class RoomArchiveService {
  private readonly logger = new Logger(RoomArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly updates: RoomUpdatesService,
    private readonly sync: SyncService,
  ) {}

  async archive(slug: string): Promise<RoomDetailDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    if (room.archivedAt !== null) {
      throw new ConflictException('ROOM_ARCHIVED');
    }
    await this.prisma.room.update({
      where: { id: room.id },
      data: { archivedAt: new Date(), archiveReason: 'manual' },
    });
    this.logger.log(`Room ${slug} was archived`);
    await this.updates.publish(slug);
    return this.rooms.getRoom(slug);
  }

  async reopen(slug: string): Promise<RoomDetailDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    if (room.archivedAt === null) {
      throw new ConflictException('ROOM_NOT_ARCHIVED');
    }
    await this.prisma.room.update({
      where: { id: room.id },
      data: {
        archivedAt: null,
        archiveReason: null,
        autoArchive: room.archiveReason === 'auto' ? false : room.autoArchive,
      },
    });
    this.logger.log(`Room ${slug} was reopened`);
    await this.updates.publish(slug);
    await this.sync.syncRoom(room.id, 'manual');
    return this.rooms.getRoom(slug);
  }
}
