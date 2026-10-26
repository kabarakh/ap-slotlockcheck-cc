import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { LiveModule } from '../live/live.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { LocationStatusService } from './location-status.service.js';
import { LocationsController } from './locations.controller.js';
import { LocationsService } from './locations.service.js';

@Module({
  imports: [AuthModule, LiveModule, RoomsModule],
  controllers: [LocationsController],
  providers: [LocationStatusService, LocationsService],
  exports: [LocationStatusService],
})
export class LocationsModule {}
