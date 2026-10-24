import { Module } from '@nestjs/common';
import { SourceHttpService } from './source-http.service.js';

@Module({
  providers: [SourceHttpService],
  exports: [SourceHttpService],
})
export class SourceHttpModule {}
