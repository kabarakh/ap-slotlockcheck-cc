import { Injectable, NotFoundException } from '@nestjs/common';
import { createSlotFinder } from '../lock/lock.logic.js';
import { slotIdentity } from '../sync/room-source.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomUpdatesService } from '../rooms/room-updates.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import type { SetUnlockTimeDto, UnlockTimeImportResultDto } from './dto/unlock-time.dto.js';
import { parseUnlockTimeCsv } from './unlock-time-csv.js';

@Injectable()
export class UnlockTimesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly updates: RoomUpdatesService,
  ) {}

  async setManual(slug: string, request: SetUnlockTimeDto): Promise<void> {
    const room = await this.rooms.findRoomBySlug(slug);
    const updated = await this.prisma.unlockItem.updateMany({
      where: { roomId: room.id, lockerSlotId: request.lockerSlotId, lockedSlotId: request.lockedSlotId },
      data: { unlockTime: new Date(request.unlockTime), timeSource: 'manual' },
    });
    if (updated.count === 0) {
      throw new NotFoundException('UNLOCK_ITEM_NOT_FOUND');
    }
    await this.updates.publish(slug);
  }

  async importCsv(slug: string, csv: string): Promise<UnlockTimeImportResultDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const parsed = parseUnlockTimeCsv(csv);
    const slots = await this.prisma.slot.findMany({ where: { roomId: room.id } });
    const findSlot = createSlotFinder(slots.map((slot) => ({ ...slotIdentity(slot), id: slot.id })));
    const errors = [...parsed.errors];
    let updated = 0;
    for (const row of parsed.rows) {
      const locked = findSlot(row.slot);
      const locker = row.locker === null ? undefined : findSlot(row.locker);
      if (!locked || (row.locker !== null && !locker)) {
        errors.push(`Line ${row.line}: unknown slot "${locked ? row.locker : row.slot}"`);
        continue;
      }
      const result = await this.prisma.unlockItem.updateMany({
        where: { roomId: room.id, lockedSlotId: locked.id, ...(locker ? { lockerSlotId: locker.id } : {}) },
        data: { unlockTime: row.unlockTime, timeSource: 'csv' },
      });
      if (result.count === 0) {
        errors.push(`Line ${row.line}: no unlock item for "${row.slot}"`);
      }
      updated += result.count;
    }
    if (updated > 0) {
      await this.updates.publish(slug);
    }
    return { updated, errors };
  }
}
