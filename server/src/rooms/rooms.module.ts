import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { LiveModule } from '../live/live.module.js';
import { RoomUpdatesService } from './room-updates.service.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [AuthModule, LiveModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomUpdatesService],
  exports: [RoomsService, RoomUpdatesService],
})
export class RoomsModule {}
