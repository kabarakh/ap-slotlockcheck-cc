import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { SyncModule } from '../sync/sync.module.js';
import { SeedController } from './seed.controller.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [RoomsModule, SyncModule, LocationsModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
