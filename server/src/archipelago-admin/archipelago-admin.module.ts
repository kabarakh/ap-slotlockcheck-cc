import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { ArchipelagoModule } from '../sources/archipelago/archipelago.module.js';
import { SyncModule } from '../sync/sync.module.js';
import { ArchipelagoAdminConnection, ADMIN_CONNECTION_FACTORY } from './admin-connection.js';
import { ADMIN_TIMING, AdminJobsService, DEFAULT_ADMIN_TIMING } from './admin-jobs.service.js';
import { AdminSessionService } from './admin-session.service.js';
import { ArchipelagoAdminController } from './archipelago-admin.controller.js';
import { ArchipelagoAdminService } from './archipelago-admin.service.js';

@Module({
  imports: [RoomsModule, ArchipelagoModule, SyncModule, LocationsModule],
  controllers: [ArchipelagoAdminController],
  providers: [
    ArchipelagoAdminService,
    AdminJobsService,
    AdminSessionService,
    { provide: ADMIN_CONNECTION_FACTORY, useValue: () => new ArchipelagoAdminConnection() },
    { provide: ADMIN_TIMING, useValue: DEFAULT_ADMIN_TIMING },
  ],
})
export class ArchipelagoAdminModule {}
