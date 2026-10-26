import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Room } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomUpdatesService } from '../rooms/room-updates.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import type {
  AdminRole,
  LockAssignmentDto,
  ResetLockAssignmentDto,
  RoomAdminDto,
  SetLockAssignmentDto,
  UpdateRoomSettingsDto,
} from './dto/admins.dto.js';

@Injectable()
export class AdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly updates: RoomUpdatesService,
  ) {}

  async listAdmins(slug: string): Promise<RoomAdminDto[]> {
    const room = await this.rooms.findRoomBySlug(slug);
    const admins = await this.prisma.roomAdmin.findMany({
      where: { roomId: room.id },
      include: { user: true },
      orderBy: [{ isOwner: 'desc' }, { userId: 'asc' }],
    });
    return admins.map((admin) => ({
      userId: admin.userId,
      discordId: admin.user.discordId,
      name: admin.user.name,
      isOwner: admin.isOwner,
      role: admin.isOwner || admin.role !== 'helper' ? 'admin' : 'helper',
    }));
  }

  async addAdmin(slug: string, discordId: string, role: AdminRole = 'admin'): Promise<RoomAdminDto[]> {
    const room = await this.rooms.findRoomBySlug(slug);
    const slot = await this.prisma.slot.findFirst({ where: { roomId: room.id, discordUserId: discordId } });
    if (!slot) {
      throw new BadRequestException('NOT_A_PLAYER');
    }
    const user = await this.prisma.user.upsert({
      where: { discordId },
      create: { discordId, name: slot.discordName ?? discordId },
      update: {},
    });
    const existing = await this.prisma.roomAdmin.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
    });
    if (existing) {
      throw new ConflictException('ALREADY_ADMIN');
    }
    await this.prisma.roomAdmin.create({ data: { roomId: room.id, userId: user.id, role } });
    return this.listAdmins(slug);
  }

  async removeAdmin(slug: string, userId: number): Promise<RoomAdminDto[]> {
    const room = await this.rooms.findRoomBySlug(slug);
    const admin = await this.prisma.roomAdmin.findUnique({ where: { roomId_userId: { roomId: room.id, userId } } });
    if (!admin) {
      throw new NotFoundException('ADMIN_NOT_FOUND');
    }
    if (admin.isOwner) {
      throw new ConflictException('OWNER_CANNOT_BE_REMOVED');
    }
    await this.prisma.roomAdmin.delete({ where: { roomId_userId: { roomId: room.id, userId } } });
    return this.listAdmins(slug);
  }

  async updateSettings(slug: string, settings: UpdateRoomSettingsDto): Promise<void> {
    const room = await this.rooms.findRoomBySlug(slug);
    const yellow = settings.yellowLimitHours ?? room.yellowLimitHours;
    const red = settings.redLimitHours ?? room.redLimitHours;
    if (yellow > red) {
      throw new BadRequestException('YELLOW_LIMIT_ABOVE_RED_LIMIT');
    }
    const limitsChanged = settings.yellowLimitHours !== undefined || settings.redLimitHours !== undefined;
    await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: room.id },
        data: {
          title: settings.title ?? room.title,
          yellowLimitHours: yellow,
          redLimitHours: red,
          limitsOverridden: settings.useCheeseLimits ? false : limitsChanged || room.limitsOverridden,
          sphereOffset: settings.sphereOffset ?? room.sphereOffset,
          visitorsSeeLocations: settings.visitorsSeeLocations ?? room.visitorsSeeLocations,
          playersMarkFiller: settings.playersMarkFiller ?? room.playersMarkFiller,
        },
      });
      if (settings.slotLockPositions) {
        await this.updateSlotLockSelection(tx, room, settings.slotLockPositions);
      }
    });
    await this.updates.publish(slug);
  }

  async listLockAssignments(slug: string): Promise<LockAssignmentDto[]> {
    const room = await this.rooms.findRoomBySlug(slug);
    const locks = await this.prisma.lockAssignment.findMany({ where: { roomId: room.id } });
    return locks.map((lock) => ({
      lockerSlotId: lock.lockerSlotId,
      lockedSlotId: lock.lockedSlotId,
      source: lock.source === 'admin' ? 'admin' : 'detected',
      notLocked: lock.notLocked,
    }));
  }

  async setLockAssignment(slug: string, request: SetLockAssignmentDto): Promise<LockAssignmentDto[]> {
    const room = await this.rooms.findRoomBySlug(slug);
    await this.assertLockPair(room, request.lockerSlotId, request.lockedSlotId);
    await this.prisma.lockAssignment.upsert({
      where: { lockerSlotId_lockedSlotId: { lockerSlotId: request.lockerSlotId, lockedSlotId: request.lockedSlotId } },
      create: {
        roomId: room.id,
        lockerSlotId: request.lockerSlotId,
        lockedSlotId: request.lockedSlotId,
        source: 'admin',
        notLocked: !request.locked,
      },
      update: { source: 'admin', notLocked: !request.locked },
    });
    await this.updates.publish(slug);
    return this.listLockAssignments(slug);
  }

  async resetLockAssignment(slug: string, request: ResetLockAssignmentDto): Promise<LockAssignmentDto[]> {
    const room = await this.rooms.findRoomBySlug(slug);
    await this.prisma.lockAssignment.deleteMany({
      where: {
        roomId: room.id,
        lockerSlotId: request.lockerSlotId,
        lockedSlotId: request.lockedSlotId,
        source: 'admin',
      },
    });
    await this.updates.publish(slug);
    return this.listLockAssignments(slug);
  }

  private async assertLockPair(room: Room, lockerSlotId: number, lockedSlotId: number): Promise<void> {
    const slots = await this.prisma.slot.findMany({
      where: { roomId: room.id, id: { in: [lockerSlotId, lockedSlotId] } },
    });
    const locker = slots.find((slot) => slot.id === lockerSlotId);
    const locked = slots.find((slot) => slot.id === lockedSlotId);
    if (!locker?.isSelectedSlotLock || !locked || locked.isSlotLock) {
      throw new BadRequestException('INVALID_LOCK_PAIR');
    }
  }

  private async updateSlotLockSelection(tx: Prisma.TransactionClient, room: Room, positions: number[]): Promise<void> {
    const slotLockSlots = await tx.slot.findMany({ where: { roomId: room.id, isSlotLock: true } });
    const valid = new Set(slotLockSlots.map((slot) => slot.position));
    if (positions.length === 0 || !positions.every((position) => valid.has(position))) {
      throw new BadRequestException('INVALID_SLOTLOCK_SELECTION');
    }
    for (const slot of slotLockSlots) {
      await tx.slot.update({ where: { id: slot.id }, data: { isSelectedSlotLock: positions.includes(slot.position) } });
    }
  }
}
