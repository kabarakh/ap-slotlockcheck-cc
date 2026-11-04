import { Module } from '@nestjs/common';

import { RoomsModule } from '../rooms/rooms.module.js';
import { ChecksHistoryModule } from './checks-history.module.js';
import { PaceSignalsModule } from './pace-signals.module.js';
import { PaceController } from './pace.controller.js';
import { PaceService } from './pace.service.js';

@Module({
  imports: [RoomsModule, ChecksHistoryModule, PaceSignalsModule],
  controllers: [PaceController],
  providers: [PaceService],
})
export class PaceModule {}
