import { Module } from '@nestjs/common';

import { ChecksHistoryModule } from '../pace/checks-history.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { StatisticsController } from './statistics.controller.js';
import { StatisticsService } from './statistics.service.js';

@Module({
  imports: [RoomsModule, ChecksHistoryModule],
  controllers: [StatisticsController],
  providers: [StatisticsService],
})
export class StatisticsModule {}
