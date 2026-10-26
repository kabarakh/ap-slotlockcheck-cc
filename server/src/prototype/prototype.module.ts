import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ArchipelagoModule } from '../sources/archipelago/archipelago.module.js';
import { CheeseModule } from '../sources/cheese/cheese.module.js';
import { RoomSourceService } from '../sync/room-source.service.js';

@Module({
  imports: [ConfigModule, PrismaModule, CheeseModule, ArchipelagoModule],
  providers: [RoomSourceService],
})
export class PrototypeModule {}
