import { Module } from '@nestjs/common';

import { RoomsModule } from '../rooms/rooms.module.js';
import { NotesController } from './notes.controller.js';
import { NotesService } from './notes.service.js';

@Module({
  imports: [RoomsModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
