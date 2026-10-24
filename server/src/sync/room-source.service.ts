import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { parseArchipelagoLink } from '../sources/archipelago/archipelago-link.js';
import type { SlotDataTracker, StaticTracker, TrackerData } from '../sources/archipelago/archipelago.schemas.js';
import { ArchipelagoService } from '../sources/archipelago/archipelago.service.js';
import type { CheeseTracker } from '../sources/cheese/cheese.schemas.js';
import { CheeseService } from '../sources/cheese/cheese.service.js';
import { itemNamesById, SLOTLOCK_GAME } from './room-source.mapper.js';

export interface RoomSource {
  cheese: CheeseTracker;
  archipelagoOrigin: string;
  archipelagoTrackerId: string;
  archipelagoRoomId: string | null;
  tracker: TrackerData;
  staticTracker: StaticTracker;
  slotData: SlotDataTracker;
  slotLockItemNames: Map<number, string>;
}

export class RoomSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoomSourceError';
  }
}

@Injectable()
export class RoomSourceService {
  constructor(
    private readonly cheese: CheeseService,
    private readonly archipelago: ArchipelagoService,
    private readonly prisma: PrismaService,
  ) {}

  async fetch(cheeseTrackerId: string): Promise<RoomSource> {
    const cheese = await this.cheese.getTracker(cheeseTrackerId);
    const trackerLink = parseArchipelagoLink(cheese.upstream_url, 'tracker');
    if (!trackerLink) {
      throw new RoomSourceError(`The Cheese tracker has no Archipelago tracker link: ${cheese.upstream_url}`);
    }
    const roomLink = parseArchipelagoLink(cheese.room_link, 'room');
    const staticTracker = await this.archipelago.getStaticTracker(trackerLink.origin, trackerLink.id);
    const tracker = await this.archipelago.getTracker(trackerLink.origin, trackerLink.id);
    const slotData = await this.archipelago.getSlotData(trackerLink.origin, trackerLink.id);
    const slotLockItemNames = await this.slotLockItemNames(trackerLink.origin, staticTracker);
    return {
      cheese,
      archipelagoOrigin: trackerLink.origin,
      archipelagoTrackerId: trackerLink.id,
      archipelagoRoomId: roomLink?.id ?? null,
      tracker,
      staticTracker,
      slotData,
      slotLockItemNames,
    };
  }

  private async slotLockItemNames(origin: string, staticTracker: StaticTracker): Promise<Map<number, string>> {
    const checksum = staticTracker.datapackage[SLOTLOCK_GAME]?.checksum;
    if (!checksum) {
      return new Map();
    }
    const cached = await this.prisma.datapackage.findUnique({ where: { checksum } });
    if (cached) {
      return itemNamesById(JSON.parse(cached.itemNames) as Record<string, number>);
    }
    const datapackage = await this.archipelago.getDatapackage(origin, checksum);
    await this.prisma.datapackage.create({
      data: { checksum, game: SLOTLOCK_GAME, itemNames: JSON.stringify(datapackage.item_name_to_id) },
    });
    return itemNamesById(datapackage.item_name_to_id);
  }
}
