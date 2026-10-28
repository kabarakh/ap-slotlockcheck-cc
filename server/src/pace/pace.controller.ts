import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

import { RequireRoomRole } from '../auth/auth.decorators.js';
import { RoomPaceDto, SlotTimelineDto } from './dto/pace.dto.js';
import { PaceService } from './pace.service.js';

@Controller('rooms/:slug/pace')
export class PaceController {
  constructor(private readonly pace: PaceService) {}

  @Get()
  @RequireRoomRole('helper')
  get(@Param('slug') slug: string): Promise<RoomPaceDto> {
    return this.pace.getRoomPace(slug);
  }

  @Get('slots/:slotId')
  @RequireRoomRole('helper')
  getSlotTimeline(
    @Param('slug') slug: string,
    @Param('slotId', ParseIntPipe) slotId: number,
  ): Promise<SlotTimelineDto> {
    return this.pace.getSlotTimeline(slug, slotId);
  }
}
