import { Module } from '@nestjs/common';

import { SourceHttpModule } from '../http/http.module.js';
import { CheeseService } from './cheese.service.js';

@Module({
  imports: [SourceHttpModule],
  providers: [CheeseService],
  exports: [CheeseService],
})
export class CheeseModule {}
