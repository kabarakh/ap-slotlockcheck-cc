import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module.js';
import { AdminsController, LockAssignmentsController, RoomSettingsController } from './admins.controller.js';
import { AdminsService } from './admins.service.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { RoomOwnershipController } from './room-ownership.controller.js';
import { RoomOwnershipService } from './room-ownership.service.js';

@Module({
  imports: [RoomsModule],
  controllers: [
    AdminsController,
    RoomSettingsController,
    LockAssignmentsController,
    InvitationsController,
    RoomOwnershipController,
  ],
  providers: [AdminsService, InvitationsService, RoomOwnershipService],
})
export class AdminsModule {}
