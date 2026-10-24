import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RoomRole } from '../rooms/dto/room.dto.js';
import { REQUIRE_ROOM_ROLE_KEY } from './auth.decorators.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { RoomRoleService } from './room-role.service.js';

@Injectable()
export class RoomRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roles: RoomRoleService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RoomRole | undefined>(REQUIRE_ROOM_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const slug = request.params['slug'];
    const room = typeof slug === 'string' ? await this.prisma.room.findUnique({ where: { slug } }) : null;
    if (!room) {
      throw new NotFoundException('Room not found');
    }
    const membership = await this.roles.getMembership(request.user, room);
    if (!RoomRoleService.satisfies(membership.role, required)) {
      throw new ForbiddenException(`Role ${required} required`);
    }
    return true;
  }
}
