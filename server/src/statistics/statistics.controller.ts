import { Controller, Get, Param, Query } from '@nestjs/common';

import { RequireRoomRole } from '../auth/auth.decorators.js';
import { HistoryQueryDto, RoomDependenciesDto, RoomHistoryDto } from './dto/statistics.dto.js';
import { StatisticsService } from './statistics.service.js';

@Controller('rooms/:slug/statistics')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get('history')
  getHistory(@Param('slug') slug: string, @Query() query: HistoryQueryDto): Promise<RoomHistoryDto> {
    return this.statistics.getHistory(slug, query.slotIds);
  }

  @Get('dependencies')
  @RequireRoomRole('helper')
  getDependencies(@Param('slug') slug: string): Promise<RoomDependenciesDto> {
    return this.statistics.getDependencies(slug);
  }
}
