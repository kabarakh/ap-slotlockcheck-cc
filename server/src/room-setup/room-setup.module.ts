import { Module } from '@nestjs/common';

import { RoomsModule } from '../rooms/rooms.module.js';
import { CheeseModule } from '../sources/cheese/cheese.module.js';
import { SyncModule } from '../sync/sync.module.js';
import { RoomSetupController } from './room-setup.controller.js';
import { RoomSetupService } from './room-setup.service.js';

@Module({
  imports: [CheeseModule, RoomsModule, SyncModule],
  controllers: [RoomSetupController],
  providers: [RoomSetupService],
})
export class RoomSetupModule {}
