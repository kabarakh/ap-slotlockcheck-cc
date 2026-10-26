import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { LiveGateway } from '../live/live.gateway.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { notGoaledSlotFilter } from './goal.logic.js';
import { newlyCheckedLocationIds, type PlayerChecks } from './location-checks.logic.js';

const UPDATE_BLOCK_SIZE = 500;

@Injectable()
export class LocationStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly live: LiveGateway,
  ) {}

  async applyChecks(tx: Prisma.TransactionClient, roomId: number, checks: PlayerChecks[], now: Date): Promise<number> {
    const unchecked = await tx.seedLocation.findMany({
      where: { roomId, checked: false },
      select: { id: true, locationId: true, finderSlot: { select: { position: true } } },
    });
    const ids = newlyCheckedLocationIds(
      unchecked.map((location) => ({
        id: location.id,
        finderPosition: location.finderSlot.position,
        locationId: location.locationId,
      })),
      checks,
    );
    for (let start = 0; start < ids.length; start += UPDATE_BLOCK_SIZE) {
      await tx.seedLocation.updateMany({
        where: { id: { in: ids.slice(start, start + UPDATE_BLOCK_SIZE) } },
        data: { checked: true, checkedFirstSeenAt: now },
      });
    }
    return ids.length;
  }

  async lowestOpenSphere(roomId: number): Promise<number | null> {
    const result = await this.prisma.seedLocation.aggregate({
      where: { roomId, checked: false, finderSlot: notGoaledSlotFilter },
      _min: { sphere: true },
    });
    return result._min.sphere;
  }

  async publishChanged(slug: string, roomId: number, changedCount: number): Promise<void> {
    this.live.publishLocationsChanged({ slug, lowestOpenSphere: await this.lowestOpenSphere(roomId), changedCount });
  }
}
