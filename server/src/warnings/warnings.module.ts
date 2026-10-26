import { Module } from '@nestjs/common';

import { RoomsModule } from '../rooms/rooms.module.js';
import { WarningsController } from './warnings.controller.js';
import { WarningsService } from './warnings.service.js';

@Module({
  imports: [RoomsModule],
  controllers: [WarningsController],
  providers: [WarningsService],
})
export class WarningsModule {}
