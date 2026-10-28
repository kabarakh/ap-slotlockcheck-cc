import { Controller, Get, Param } from '@nestjs/common';

import { RequireRoomRole } from '../auth/auth.decorators.js';
import { RoomPaceDto } from './dto/pace.dto.js';
import { PaceService } from './pace.service.js';

@Controller('rooms/:slug/pace')
export class PaceController {
  constructor(private readonly pace: PaceService) {}

  @Get()
  @RequireRoomRole('helper')
  get(@Param('slug') slug: string): Promise<RoomPaceDto> {
    return this.pace.getRoomPace(slug);
  }
}
