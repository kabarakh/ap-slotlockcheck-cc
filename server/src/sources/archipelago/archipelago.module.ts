import { Module } from '@nestjs/common';

import { SourceHttpModule } from '../http/http.module.js';
import { ArchipelagoService } from './archipelago.service.js';

@Module({
  imports: [SourceHttpModule],
  providers: [ArchipelagoService],
  exports: [ArchipelagoService],
})
export class ArchipelagoModule {}
