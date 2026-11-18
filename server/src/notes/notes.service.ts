import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';

import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomUpdatesService } from '../rooms/room-updates.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import type { InternalNoteDto, StaffNoteDto } from './dto/slot-note.dto.js';
import { isSlotNoteKind, toSlotNoteView } from './notes.logic.js';

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly updates: RoomUpdatesService,
  ) {}

  async listInternal(slug: string): Promise<InternalNoteDto[]> {
    const room = await this.rooms.findRoomBySlug(slug);
    const notes = await this.prisma.slotNote.findMany({
      where: { kind: 'internal', slot: { roomId: room.id } },
      include: { updatedBy: true },
    });
    return notes.map((note) => ({ slotId: note.slotId, ...toSlotNoteView(note) }));
  }

  async update(slug: string, slotId: number, kind: string, text: string, user: AuthUser): Promise<StaffNoteDto> {
    if (!isSlotNoteKind(kind)) {
      throw new BadRequestException('NOTE_KIND_UNKNOWN');
    }
    const room = await this.rooms.findRoomBySlug(slug);
    if (room.archivedAt) {
      throw new ConflictException('ROOM_ARCHIVED');
    }
    const slot = await this.prisma.slot.findFirst({ where: { id: slotId, roomId: room.id } });
    if (!slot) {
      throw new BadRequestException('SLOT_NOT_IN_ROOM');
    }
    const values = { text, updatedAt: new Date(), updatedByUserId: user.id };
    const note = await this.prisma.slotNote.upsert({
      where: { slotId_kind: { slotId, kind } },
      create: { slotId, kind, ...values },
      update: values,
      include: { updatedBy: true },
    });
    await this.updates.publish(slug);
    return toSlotNoteView(note);
  }
}
