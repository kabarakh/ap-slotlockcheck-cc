import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module.js';
import { AdminsController, LockAssignmentsController, RoomSettingsController } from './admins.controller.js';
import { AdminsService } from './admins.service.js';

@Module({
  imports: [RoomsModule],
  controllers: [AdminsController, RoomSettingsController, LockAssignmentsController],
  providers: [AdminsService],
})
export class AdminsModule {}
