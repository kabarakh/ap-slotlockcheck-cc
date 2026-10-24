import { Module } from '@nestjs/common';
import { LiveGateway } from './live.gateway.js';

@Module({
  providers: [LiveGateway],
  exports: [LiveGateway],
})
export class LiveModule {}
