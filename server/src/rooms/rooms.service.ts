import { Injectable, NotFoundException } from '@nestjs/common';

import type { AuthUser } from '../auth/auth.types.js';
import { AppConfigService } from '../config/app-config.service.js';
import type { Room } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  RoomDetailDto,
  RoomListEntryDto,
  RoomMembershipDto,
  RoomSummaryDto,
  SyncStatusDto,
} from './dto/room.dto.js';
import type { SlotRowDto } from './dto/slot-row.dto.js';
import { buildRoster, countLockStates } from './roster.builder.js';

type RoomSummaryFields = Pick<RoomSummaryDto, keyof RoomSummaryDto>;

@Injectable()
export class RoomsService {
  private readonly runningSyncs = new Set<number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  markSyncRunning(roomId: number, running: boolean): void {
    if (running) {
      this.runningSyncs.add(roomId);
    } else {
      this.runningSyncs.delete(roomId);
    }
  }

  isSyncRunning(roomId: number): boolean {
    return this.runningSyncs.has(roomId);
  }

  async findRoomBySlug(slug: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { slug } });
    if (!room) {
      throw new NotFoundException(`Room ${slug} not found`);
    }
    return room;
  }

  async listRoomsOf(
    user: Pick<AuthUser, 'id' | 'discordId'> | undefined,
    membershipOf: (room: Room) => Promise<RoomMembershipDto>,
  ): Promise<RoomListEntryDto[]> {
    if (!user) {
      return [];
    }
    const rooms = await this.prisma.room.findMany({
      where: {
        OR: [{ admins: { some: { userId: user.id } } }, { slots: { some: { discordUserId: user.discordId } } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      rooms.map(async (room) => ({
        ...this.toSummary(room, await this.getRosterForRoom(room.id)),
        membership: await membershipOf(room),
      })),
    );
  }

  async getRoom(slug: string): Promise<RoomDetailDto> {
    const room = await this.findRoomBySlug(slug);
    return this.toDetail(room, await this.getRosterForRoom(room.id), await this.hasSeed(room.id));
  }

  async hasSeed(roomId: number): Promise<boolean> {
    return (await this.prisma.seedData.count({ where: { roomId } })) > 0;
  }

  async getRoster(slug: string): Promise<SlotRowDto[]> {
    const room = await this.findRoomBySlug(slug);
    return this.getRosterForRoom(room.id);
  }

  async getRosterForRoom(roomId: number): Promise<SlotRowDto[]> {
    const [slots, locks, unlocks] = await Promise.all([
      this.prisma.slot.findMany({ where: { roomId } }),
      this.prisma.lockAssignment.findMany({ where: { roomId, notLocked: false } }),
      this.prisma.unlockItem.findMany({ where: { roomId } }),
    ]);
    return buildRoster({
      slots,
      locks,
      unlocks,
    });
  }

  toSyncStatus(room: Room): SyncStatusDto {
    return {
      lastSyncAt: room.lastSyncAt?.toISOString() ?? null,
      lastSuccessfulSyncAt: room.lastSuccessfulSyncAt?.toISOString() ?? null,
      lastSyncError: room.lastSyncError,
      running: this.isSyncRunning(room.id),
    };
  }

  toSummary(room: Room, roster: SlotRowDto[]): RoomSummaryFields {
    const counts = countLockStates(roster);
    return {
      id: room.id,
      slug: room.slug,
      title: room.title,
      slotCount: roster.length,
      lockedSlotCount: counts.locked,
      unlockedSlotCount: counts.unlocked,
      unlockedPercentage: counts.percentage,
      checksDone: roster.reduce((sum, slot) => sum + slot.checksDone, 0),
      checksTotal: roster.reduce((sum, slot) => sum + slot.checksTotal, 0),
      syncStatus: this.toSyncStatus(room),
    };
  }

  toDetail(room: Room, roster: SlotRowDto[], hasSeed: boolean): RoomDetailDto {
    return {
      ...this.toSummary(room, roster),
      cheeseTrackerId: room.cheeseTrackerId,
      cheeseTrackerUrl: new URL(`/tracker/${room.cheeseTrackerId}`, this.config.get('CHEESE_BASE_URL')).toString(),
      archipelagoTrackerUrl: new URL(`/tracker/${room.archipelagoTrackerId}`, room.archipelagoOrigin).toString(),
      yellowLimitHours: room.yellowLimitHours,
      redLimitHours: room.redLimitHours,
      limitsOverridden: room.limitsOverridden,
      unknownSlotNames: JSON.parse(room.unknownSlotNames) as string[],
      manualSyncCooldownSeconds: this.config.get('MANUAL_SYNC_COOLDOWN_SECONDS'),
      hasSeed,
      sphereOffset: room.sphereOffset,
      visitorsSeeLocations: room.visitorsSeeLocations,
      playersMarkFiller: room.playersMarkFiller,
    };
  }
}
