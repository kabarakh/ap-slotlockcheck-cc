import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import type { Room } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomUpdatesService } from '../rooms/room-updates.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { AdminsService } from './admins.service.js';
import type { RoomAdminDto } from './dto/admins.dto.js';
import type { DeleteRoomDto, TransferOwnerDto } from './dto/room-ownership.dto.js';

@Injectable()
export class RoomOwnershipService {
  private readonly logger = new Logger(RoomOwnershipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly admins: AdminsService,
    private readonly updates: RoomUpdatesService,
  ) {}

  async transfer(slug: string, owner: AuthUser, request: TransferOwnerDto): Promise<RoomAdminDto[]> {
    const room = await this.ownedRoom(slug, owner);
    if (request.discordId === owner.discordId) {
      throw new BadRequestException('ALREADY_OWNER');
    }
    const newOwnerId = await this.userForTransfer(room, request.discordId);
    await this.prisma.$transaction(async (tx) => {
      if (request.stayAdmin) {
        await tx.roomAdmin.update({
          where: { roomId_userId: { roomId: room.id, userId: owner.id } },
          data: { isOwner: false, role: 'admin' },
        });
      } else {
        await tx.roomAdmin.delete({ where: { roomId_userId: { roomId: room.id, userId: owner.id } } });
      }
      await tx.roomAdmin.upsert({
        where: { roomId_userId: { roomId: room.id, userId: newOwnerId } },
        create: { roomId: room.id, userId: newOwnerId, isOwner: true, role: 'admin' },
        update: { isOwner: true, role: 'admin' },
      });
    });
    this.logger.log(`The owner of room ${slug} was transferred`);
    await this.updates.publish(slug);
    return this.admins.listAdmins(slug);
  }

  async leave(slug: string, user: AuthUser): Promise<void> {
    const room = await this.rooms.findRoomBySlug(slug);
    const admin = await this.prisma.roomAdmin.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
    });
    if (!admin) {
      throw new NotFoundException('ADMIN_NOT_FOUND');
    }
    if (admin.isOwner) {
      throw new ConflictException('OWNER_CANNOT_LEAVE');
    }
    await this.prisma.roomAdmin.delete({ where: { roomId_userId: { roomId: room.id, userId: user.id } } });
  }

  async delete(slug: string, owner: AuthUser, request: DeleteRoomDto): Promise<void> {
    const room = await this.ownedRoom(slug, owner);
    if (request.title !== room.title) {
      throw new BadRequestException('ROOM_TITLE_MISMATCH');
    }
    await this.prisma.room.delete({ where: { id: room.id } });
    this.logger.log(`Room ${slug} was deleted`);
  }

  private async ownedRoom(slug: string, user: AuthUser): Promise<Room> {
    const room = await this.rooms.findRoomBySlug(slug);
    const admin = await this.prisma.roomAdmin.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
    });
    if (!admin?.isOwner) {
      throw new ForbiddenException('OWNER_REQUIRED');
    }
    return room;
  }

  private async userForTransfer(room: Room, discordId: string): Promise<number> {
    const existing = await this.prisma.user.findUnique({ where: { discordId } });
    if (existing) {
      const admin = await this.prisma.roomAdmin.findUnique({
        where: { roomId_userId: { roomId: room.id, userId: existing.id } },
      });
      if (admin) {
        return existing.id;
      }
    }
    const slot = await this.prisma.slot.findFirst({ where: { roomId: room.id, discordUserId: discordId } });
    if (!slot) {
      throw new BadRequestException('NOT_A_PLAYER');
    }
    const user = await this.prisma.user.upsert({
      where: { discordId },
      create: { discordId, name: slot.discordName ?? discordId },
      update: {},
    });
    return user.id;
  }
}
