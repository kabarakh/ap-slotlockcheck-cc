import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';

import type { AuthUser } from '../auth/auth.types.js';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import type { AdminRole } from './dto/admins.dto.js';
import type { AcceptedInvitationDto, AdminInvitationDto } from './dto/invitation.dto.js';

export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly config: AppConfigService,
  ) {}

  async create(slug: string, admin: AuthUser, role: AdminRole): Promise<AdminInvitationDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const token = randomBytes(32).toString('base64url');
    const validUntil = new Date(Date.now() + INVITATION_LIFETIME_MS);
    await this.prisma.adminInvitation.create({
      data: { roomId: room.id, tokenHash: hashInvitationToken(token), validUntil, createdByUserId: admin.id, role },
    });
    return {
      url: new URL(`/invite/${token}`, this.config.get('PUBLIC_BASE_URL')).toString(),
      validUntil: validUntil.toISOString(),
      role,
    };
  }

  async accept(token: string, user: AuthUser): Promise<AcceptedInvitationDto> {
    const invitation = await this.prisma.adminInvitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      include: { room: true },
    });
    if (!invitation) {
      throw new NotFoundException('INVITATION_NOT_FOUND');
    }
    if (invitation.usedAt !== null || invitation.validUntil.getTime() < Date.now()) {
      throw new GoneException('INVITATION_EXPIRED');
    }
    const role = invitation.role === 'helper' ? 'helper' : 'admin';
    await this.prisma.$transaction([
      this.prisma.adminInvitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date(), usedByUserId: user.id },
      }),
      this.prisma.roomAdmin.upsert({
        where: { roomId_userId: { roomId: invitation.roomId, userId: user.id } },
        create: { roomId: invitation.roomId, userId: user.id, role },
        update: {},
      }),
    ]);
    return { slug: invitation.room.slug };
  }
}
