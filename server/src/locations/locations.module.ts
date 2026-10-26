import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module.js';
import { LocationStatusService } from './location-status.service.js';

@Module({
  imports: [LiveModule],
  providers: [LocationStatusService],
  exports: [LocationStatusService],
})
export class LocationsModule {}
