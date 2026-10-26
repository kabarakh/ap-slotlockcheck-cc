import { Module } from '@nestjs/common';

import { LiveModule } from '../live/live.module.js';
import { LocationsModule } from '../locations/locations.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { ArchipelagoModule } from '../sources/archipelago/archipelago.module.js';
import { CheeseModule } from '../sources/cheese/cheese.module.js';
import { RoomSourceService } from './room-source.service.js';
import { SyncController } from './sync.controller.js';
import { SyncScheduler } from './sync.scheduler.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [CheeseModule, ArchipelagoModule, RoomsModule, LiveModule, LocationsModule],
  controllers: [SyncController],
  providers: [SyncService, SyncScheduler, RoomSourceService],
  exports: [SyncService, RoomSourceService],
})
export class SyncModule {}
