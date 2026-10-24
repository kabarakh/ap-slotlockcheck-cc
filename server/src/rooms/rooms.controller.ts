import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { RoomRoleService } from '../auth/room-role.service.js';
import { RoomDetailDto, RoomMembershipDto, RoomSummaryDto } from './dto/room.dto.js';
import { SlotRowDto } from './dto/slot-row.dto.js';
import { RoomsService } from './rooms.service.js';

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    private readonly roles: RoomRoleService,
  ) {}

  @Get()
  listRooms(): Promise<RoomSummaryDto[]> {
    return this.rooms.listRooms();
  }

  @Get(':slug')
  getRoom(@Param('slug') slug: string): Promise<RoomDetailDto> {
    return this.rooms.getRoom(slug);
  }

  @Get(':slug/roster')
  getRoster(@Param('slug') slug: string): Promise<SlotRowDto[]> {
    return this.rooms.getRoster(slug);
  }

  @Get(':slug/me')
  async getMembership(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<RoomMembershipDto> {
    return this.roles.getMembership(user, await this.rooms.findRoomBySlug(slug));
  }
}
