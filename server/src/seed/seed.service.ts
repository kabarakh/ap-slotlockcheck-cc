import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { rm } from 'node:fs/promises';

import { websocketAddress } from '../archipelago-admin/server-target.logic.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { LocationStatusService } from '../locations/location-status.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomUpdatesService } from '../rooms/room-updates.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { ArchipelagoService } from '../sources/archipelago/archipelago.service.js';
import { SyncService } from '../sync/sync.service.js';
import type { SeedComparisonDto, SeedDataDto } from './dto/seed.dto.js';
import { MultidataFormatError, readMultidata, type MultidataContent } from './multidata.reader.js';
import { readSeedFile } from './seed-file.reader.js';
import { seedDifferences } from './seed-match.logic.js';
import { SERVER_SEED_READER, type ServerSeedReader } from './server-seed.reader.js';

const INSERT_BLOCK_SIZE = 1000;
const UPLOAD_TRANSACTION_TIMEOUT_MILLISECONDS = 5 * 60 * 1000;

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly updates: RoomUpdatesService,
    private readonly sync: SyncService,
    private readonly locationStatus: LocationStatusService,
    private readonly archipelago: ArchipelagoService,
    @Inject(SERVER_SEED_READER) private readonly readServerSeed: ServerSeedReader,
  ) {}

  async get(slug: string): Promise<SeedDataDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const seed = await this.prisma.seedData.findUnique({ where: { roomId: room.id }, include: { uploadedBy: true } });
    if (!seed) {
      throw new NotFoundException('SEED_NOT_FOUND');
    }
    return {
      seedName: seed.seedName,
      archipelagoVersion: seed.archipelagoVersion,
      locationCount: seed.locationCount,
      sphereCount: seed.sphereCount,
      unreachableLocationCount: seed.unreachableLocationCount,
      uploadedAt: seed.uploadedAt.toISOString(),
      uploadedByName: seed.uploadedBy.name,
    };
  }

  async compare(slug: string): Promise<SeedComparisonDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const seed = await this.prisma.seedData.findUnique({ where: { roomId: room.id } });
    const uploadedSeedName = seed?.seedName ?? null;
    let serverSeedName: string | null = null;
    let serverError: string | null = null;
    if (room.archipelagoRoomId) {
      try {
        await this.archipelago.wakeRoom(room.archipelagoOrigin, room.archipelagoRoomId);
        const status = await this.archipelago.getRoomStatus(room.archipelagoOrigin, room.archipelagoRoomId);
        serverSeedName = await this.readServerSeed(websocketAddress(room.archipelagoOrigin, status.last_port));
      } catch (error) {
        this.logger.warn(`Seed of the Archipelago server for room ${slug} not readable: ${String(error)}`);
        serverError = 'SERVER_SEED_UNAVAILABLE';
      }
    } else {
      serverError = 'ROOM_LINK_MISSING';
    }
    const matches = uploadedSeedName !== null && serverSeedName !== null ? uploadedSeedName === serverSeedName : null;
    return { uploadedSeedName, serverSeedName, serverError, matches };
  }

  async upload(slug: string, admin: AuthUser, path: string | undefined): Promise<SeedDataDto> {
    try {
      return await this.save(slug, admin, path);
    } finally {
      if (path) {
        await rm(path, { force: true });
      }
    }
  }

  private async save(slug: string, admin: AuthUser, path: string | undefined): Promise<SeedDataDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    if (await this.rooms.hasSeed(room.id)) {
      throw new ConflictException('SEED_ALREADY_UPLOADED');
    }
    if (!path) {
      throw new BadRequestException('SEED_FILE_MISSING');
    }
    const content = await this.read(path);
    const slots = await this.prisma.slot.findMany({ where: { roomId: room.id } });
    const differences = seedDifferences(slots, content.players);
    if (differences.length > 0) {
      throw new BadRequestException({ message: 'SEED_DOES_NOT_MATCH_ROOM', differences });
    }
    const slotIdByPosition = new Map(slots.map((slot) => [slot.position, slot.id]));
    await this.prisma.$transaction(
      async (tx) => {
        await tx.seedData.create({
          data: {
            roomId: room.id,
            seedName: content.seedName,
            archipelagoVersion: content.archipelagoVersion,
            locationCount: content.locations.length,
            sphereCount: content.sphereCount,
            unreachableLocationCount: content.unreachableLocationCount,
            uploadedByUserId: admin.id,
          },
        });
        await this.insertLocations(tx, room.id, content, slotIdByPosition);
      },
      { timeout: UPLOAD_TRANSACTION_TIMEOUT_MILLISECONDS },
    );
    await this.saveDatapackages(content);
    this.logger.log(`Seed ${content.seedName} with ${content.locations.length} locations saved for room ${slug}`);
    await this.sync.syncRoom(room.id, 'seed');
    await this.updates.publish(slug);
    await this.locationStatus.publishChanged(slug, room.id, content.locations.length);
    return this.get(slug);
  }

  private async read(path: string): Promise<MultidataContent> {
    try {
      return readMultidata(await readSeedFile(path));
    } catch (error) {
      if (error instanceof MultidataFormatError) {
        throw new BadRequestException({ message: error.code, reason: error.message });
      }
      throw error;
    }
  }

  private async insertLocations(
    tx: Prisma.TransactionClient,
    roomId: number,
    content: MultidataContent,
    slotIdByPosition: Map<number, number>,
  ): Promise<void> {
    const rows = content.locations.flatMap((location) => {
      const finderSlotId = slotIdByPosition.get(location.finder);
      if (finderSlotId === undefined) {
        return [];
      }
      return [
        {
          roomId,
          finderSlotId,
          receiverSlotId: slotIdByPosition.get(location.receiver) ?? null,
          receiverName: location.receiverName,
          locationId: BigInt(location.locationId),
          locationName: location.locationName,
          itemId: BigInt(location.itemId),
          itemName: location.itemName,
          itemType: location.itemType,
          sphere: location.sphere,
        },
      ];
    });
    for (let start = 0; start < rows.length; start += INSERT_BLOCK_SIZE) {
      await tx.seedLocation.createMany({ data: rows.slice(start, start + INSERT_BLOCK_SIZE) });
    }
  }

  private async saveDatapackages(content: MultidataContent): Promise<void> {
    for (const [game, data] of content.games) {
      if (!data.checksum) {
        continue;
      }
      const itemNames = JSON.stringify(Object.fromEntries(data.itemNameToId));
      const locationNames = JSON.stringify(Object.fromEntries(data.locationNameToId));
      await this.prisma.datapackage.upsert({
        where: { checksum: data.checksum },
        create: { checksum: data.checksum, game, itemNames, locationNames },
        update: { locationNames },
      });
    }
  }
}
