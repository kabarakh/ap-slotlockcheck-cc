import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser, RequireRoomRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { RoomAdminDto } from './dto/admins.dto.js';
import { DeleteRoomDto, TransferOwnerDto } from './dto/room-ownership.dto.js';
import { RoomOwnershipService } from './room-ownership.service.js';

@Controller('rooms/:slug')
export class RoomOwnershipController {
  constructor(private readonly ownership: RoomOwnershipService) {}

  @Post('owner')
  @HttpCode(200)
  @RequireRoomRole('admin')
  transfer(
    @Param('slug') slug: string,
    @CurrentUser() owner: AuthUser,
    @Body() body: TransferOwnerDto,
  ): Promise<RoomAdminDto[]> {
    return this.ownership.transfer(slug, owner, body);
  }

  @Post('leave')
  @HttpCode(204)
  @RequireRoomRole('helper')
  leave(@Param('slug') slug: string, @CurrentUser() user: AuthUser): Promise<void> {
    return this.ownership.leave(slug, user);
  }

  @Delete()
  @HttpCode(204)
  @RequireRoomRole('admin')
  delete(@Param('slug') slug: string, @CurrentUser() owner: AuthUser, @Body() body: DeleteRoomDto): Promise<void> {
    return this.ownership.delete(slug, owner, body);
  }
}
