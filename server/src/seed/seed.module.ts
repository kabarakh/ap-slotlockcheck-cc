import { Module } from '@nestjs/common';

import { LocationsModule } from '../locations/locations.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { ArchipelagoModule } from '../sources/archipelago/archipelago.module.js';
import { SyncModule } from '../sync/sync.module.js';
import { SeedController } from './seed.controller.js';
import { SeedService } from './seed.service.js';
import { readServerSeedName, SERVER_SEED_READER } from './server-seed.reader.js';

@Module({
  imports: [RoomsModule, SyncModule, LocationsModule, ArchipelagoModule],
  controllers: [SeedController],
  providers: [SeedService, { provide: SERVER_SEED_READER, useValue: readServerSeedName }],
})
export class SeedModule {}
