import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import type { Room } from '../generated/prisma/client.js';
import type { ChecksHistoryPoint } from '../lock/unlock-time.logic.js';
import { CheeseService } from '../sources/cheese/cheese.service.js';
import { SourceFormatError, SourceRequestError } from '../sources/http/source-errors.js';
import { checksHistoryPoints } from '../sync/room-source.mapper.js';
import { CHECKS_HISTORY_CACHE_MINUTES } from './pace.constants.js';

interface CachedChecksHistory {
  fetchedAt: number;
  points: ChecksHistoryPoint[];
}

const MS_PER_MINUTE = 60_000;

@Injectable()
export class ChecksHistoryService {
  private readonly logger = new Logger(ChecksHistoryService.name);
  private readonly histories = new Map<number, CachedChecksHistory>();

  constructor(private readonly cheese: CheeseService) {}

  async get(room: Room): Promise<ChecksHistoryPoint[]> {
    const cached = this.histories.get(room.id);
    if (cached !== undefined && Date.now() - cached.fetchedAt < CHECKS_HISTORY_CACHE_MINUTES * MS_PER_MINUTE) {
      return cached.points;
    }
    let points: ChecksHistoryPoint[];
    try {
      points = checksHistoryPoints(await this.cheese.getChecksHistory(room.cheeseTrackerId));
    } catch (error) {
      if (error instanceof SourceRequestError || error instanceof SourceFormatError) {
        this.logger.warn(`Checks history of room ${room.slug} not available: ${error.message}`);
        throw new ServiceUnavailableException('CHECKS_HISTORY_NOT_AVAILABLE');
      }
      throw error;
    }
    this.histories.set(room.id, { fetchedAt: Date.now(), points });
    return points;
  }
}
