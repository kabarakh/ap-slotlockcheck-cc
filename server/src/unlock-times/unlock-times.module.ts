import { Module } from '@nestjs/common';

import { RoomsModule } from '../rooms/rooms.module.js';
import { UnlockTimesController } from './unlock-times.controller.js';
import { UnlockTimesService } from './unlock-times.service.js';

@Module({
  imports: [RoomsModule],
  controllers: [UnlockTimesController],
  providers: [UnlockTimesService],
})
export class UnlockTimesModule {}
