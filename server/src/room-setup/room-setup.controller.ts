import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser, RequireLogin } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { RoomDetailDto } from '../rooms/dto/room.dto.js';
import { CreateRoomDto, RoomPreviewDto, RoomPreviewRequestDto } from './dto/room-setup.dto.js';
import { RoomSetupService } from './room-setup.service.js';

@Controller('room-setup')
@RequireLogin()
export class RoomSetupController {
  constructor(private readonly setup: RoomSetupService) {}

  @Post('preview')
  preview(@CurrentUser() user: AuthUser, @Body() body: RoomPreviewRequestDto): Promise<RoomPreviewDto> {
    return this.setup.preview(user, body.cheeseTrackerId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateRoomDto): Promise<RoomDetailDto> {
    return this.setup.create(user, body);
  }
}
