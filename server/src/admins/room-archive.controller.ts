import { Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';

import { RequireRoomRole } from '../auth/auth.decorators.js';
import { RoomDetailDto } from '../rooms/dto/room.dto.js';
import { RoomArchiveService } from './room-archive.service.js';

@Controller('rooms/:slug/archive')
@RequireRoomRole('admin')
export class RoomArchiveController {
  constructor(private readonly archive: RoomArchiveService) {}

  @Post()
  @HttpCode(200)
  archiveRoom(@Param('slug') slug: string): Promise<RoomDetailDto> {
    return this.archive.archive(slug);
  }

  @Delete()
  reopenRoom(@Param('slug') slug: string): Promise<RoomDetailDto> {
    return this.archive.reopen(slug);
  }
}
