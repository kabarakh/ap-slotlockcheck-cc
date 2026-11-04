import { Module } from '@nestjs/common';

import { CheeseModule } from '../sources/cheese/cheese.module.js';
import { ChecksHistoryService } from './checks-history.service.js';

@Module({
  imports: [CheeseModule],
  providers: [ChecksHistoryService],
  exports: [ChecksHistoryService],
})
export class ChecksHistoryModule {}
