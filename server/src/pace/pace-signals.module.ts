import { Module } from '@nestjs/common';

import { PaceSignalsService } from './pace-signals.service.js';

@Module({
  providers: [PaceSignalsService],
  exports: [PaceSignalsService],
})
export class PaceSignalsModule {}
