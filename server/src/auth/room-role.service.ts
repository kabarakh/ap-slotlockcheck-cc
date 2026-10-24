import { Injectable } from '@nestjs/common';
import type { Room } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RoomMembershipDto, RoomRole } from '../rooms/dto/room.dto.js';
import type { AuthUser } from './auth.types.js';

const ROLE_RANK: Record<RoomRole, number> = { visitor: 0, player: 1, admin: 2 };

@Injectable()
export class RoomRoleService {
  constructor(private readonly prisma: PrismaService) {}

  static satisfies(role: RoomRole, required: RoomRole): boolean {
    return ROLE_RANK[role] >= ROLE_RANK[required];
  }

  async getMembership(user: AuthUser | undefined, room: Pick<Room, 'id'>): Promise<RoomMembershipDto> {
    if (!user) {
      return { role: 'visitor', isOwner: false };
    }
    const admin = await this.prisma.roomAdmin.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
    });
    if (admin) {
      return { role: 'admin', isOwner: admin.isOwner };
    }
    const slotCount = await this.prisma.slot.count({ where: { roomId: room.id, discordUserId: user.discordId } });
    return { role: slotCount > 0 ? 'player' : 'visitor', isOwner: false };
  }
}
