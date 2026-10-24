import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module.js';
import { AdminsController, LockAssignmentsController, RoomSettingsController } from './admins.controller.js';
import { AdminsService } from './admins.service.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  imports: [RoomsModule],
  controllers: [AdminsController, RoomSettingsController, LockAssignmentsController, InvitationsController],
  providers: [AdminsService, InvitationsService],
})
export class AdminsModule {}
