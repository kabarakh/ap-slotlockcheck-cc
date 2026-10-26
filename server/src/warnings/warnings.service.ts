import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomUpdatesService } from '../rooms/room-updates.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import type { CreateWarningDto, WarningDto } from './dto/warning.dto.js';

@Injectable()
export class WarningsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly updates: RoomUpdatesService,
  ) {}

  async list(slug: string): Promise<WarningDto[]> {
    const room = await this.rooms.findRoomBySlug(slug);
    const warnings = await this.prisma.warning.findMany({
      where: { roomId: room.id },
      include: { slot: true, admin: true },
      orderBy: { date: 'desc' },
    });
    return warnings.map((warning) => ({
      id: warning.id,
      slotId: warning.slotId,
      slotName: warning.slot.name,
      adminName: warning.admin.name,
      date: warning.date.toISOString(),
      text: warning.text,
    }));
  }

  async create(slug: string, admin: AuthUser, request: CreateWarningDto): Promise<WarningDto[]> {
    const room = await this.rooms.findRoomBySlug(slug);
    const slot = await this.prisma.slot.findFirst({ where: { id: request.slotId, roomId: room.id } });
    if (!slot) {
      throw new BadRequestException('SLOT_NOT_IN_ROOM');
    }
    await this.prisma.warning.create({
      data: {
        roomId: room.id,
        slotId: slot.id,
        adminUserId: admin.id,
        date: new Date(request.date),
        text: request.text,
      },
    });
    await this.updates.publish(slug);
    return this.list(slug);
  }

  async delete(slug: string, warningId: number): Promise<WarningDto[]> {
    const room = await this.rooms.findRoomBySlug(slug);
    const deleted = await this.prisma.warning.deleteMany({ where: { id: warningId, roomId: room.id } });
    if (deleted.count === 0) {
      throw new NotFoundException('WARNING_NOT_FOUND');
    }
    await this.updates.publish(slug);
    return this.list(slug);
  }
}
