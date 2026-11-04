import { Controller, Get, Param } from '@nestjs/common';

import { RequireRoomRole } from '../auth/auth.decorators.js';
import { RoomDependenciesDto, RoomHistoryDto } from './dto/statistics.dto.js';
import { StatisticsService } from './statistics.service.js';

@Controller('rooms/:slug/statistics')
export class StatisticsController {
  constructor(private readonly statistics: StatisticsService) {}

  @Get('history')
  getHistory(@Param('slug') slug: string): Promise<RoomHistoryDto> {
    return this.statistics.getHistory(slug);
  }

  @Get('dependencies')
  @RequireRoomRole('helper')
  getDependencies(@Param('slug') slug: string): Promise<RoomDependenciesDto> {
    return this.statistics.getDependencies(slug);
  }
}
