import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service.js';
import { SourceHttpService } from '../http/source-http.service.js';
import {
  CHEESE_TRACKER_ID_PATTERN,
  cheeseChecksHistorySchema,
  cheeseTrackerSchema,
  type CheeseChecksHistory,
  type CheeseTracker,
} from './cheese.schemas.js';

@Injectable()
export class CheeseService {
  constructor(
    private readonly http: SourceHttpService,
    private readonly config: AppConfigService,
  ) {}

  static isValidTrackerId(trackerId: string): boolean {
    return CHEESE_TRACKER_ID_PATTERN.test(trackerId);
  }

  getTracker(trackerId: string): Promise<CheeseTracker> {
    return this.http.getJson(this.trackerUrl(trackerId), cheeseTrackerSchema);
  }

  getChecksHistory(trackerId: string): Promise<CheeseChecksHistory> {
    return this.http.getJson(`${this.trackerUrl(trackerId)}/checks_history`, cheeseChecksHistorySchema);
  }

  private trackerUrl(trackerId: string): string {
    if (!CheeseService.isValidTrackerId(trackerId)) {
      throw new Error(`Invalid Cheese tracker ID: ${trackerId}`);
    }
    return new URL(`/api/tracker/${trackerId}`, this.config.get('CHEESE_BASE_URL')).toString();
  }
}
