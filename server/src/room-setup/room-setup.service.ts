import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';

import type { AuthUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RoomDetailDto } from '../rooms/dto/room.dto.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { parseArchipelagoLink } from '../sources/archipelago/archipelago-link.js';
import { CheeseService } from '../sources/cheese/cheese.service.js';
import { slotRecordsFromCheese } from '../sync/room-source.mapper.js';
import { SyncService } from '../sync/sync.service.js';
import type { CreateRoomDto, RoomPreviewDto } from './dto/room-setup.dto.js';
import { checkTrackerOwner, slugFromTitle } from './owner-check.js';

@Injectable()
export class RoomSetupService {
  constructor(
    private readonly cheese: CheeseService,
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly sync: SyncService,
  ) {}

  async preview(user: AuthUser, cheeseTrackerId: string): Promise<RoomPreviewDto> {
    const tracker = await this.cheese.getTracker(cheeseTrackerId);
    const existing = await this.prisma.room.findUnique({ where: { cheeseTrackerId } });
    return {
      cheeseTrackerId,
      title: tracker.title,
      suggestedSlug: slugFromTitle(tracker.title),
      ownerCheck: checkTrackerOwner(tracker, user),
      ownerDiscordName: tracker.owner_discord_username ?? null,
      existingSlug: existing?.slug ?? null,
      slotLockSlots: slotRecordsFromCheese(tracker)
        .filter((slot) => slot.isSlotLock)
        .map((slot) => ({ position: slot.position, name: slot.name })),
    };
  }

  async create(user: AuthUser, request: CreateRoomDto): Promise<RoomDetailDto> {
    const tracker = await this.cheese.getTracker(request.cheeseTrackerId);
    if (checkTrackerOwner(tracker, user) === 'failed') {
      throw new ForbiddenException('OWNER_CHECK_FAILED');
    }
    await this.assertUnique(request);
    const trackerLink = parseArchipelagoLink(tracker.upstream_url, 'tracker');
    if (!trackerLink) {
      throw new BadRequestException('NO_ARCHIPELAGO_TRACKER');
    }
    const records = slotRecordsFromCheese(tracker);
    const slotLockPositions = new Set(records.filter((slot) => slot.isSlotLock).map((slot) => slot.position));
    if (!request.slotLockPositions.every((position) => slotLockPositions.has(position))) {
      throw new BadRequestException('INVALID_SLOTLOCK_SELECTION');
    }
    const room = await this.prisma.room.create({
      data: {
        slug: request.slug,
        title: request.title,
        cheeseTrackerId: request.cheeseTrackerId,
        archipelagoOrigin: trackerLink.origin,
        archipelagoTrackerId: trackerLink.id,
        archipelagoRoomId: parseArchipelagoLink(tracker.room_link, 'room')?.id ?? null,
        ownerCtUserId: tracker.owner_ct_user_id ?? null,
        ownerDiscordName: tracker.owner_discord_username ?? null,
        yellowLimitHours: tracker.inactivity_threshold_yellow_hours,
        redLimitHours: tracker.inactivity_threshold_red_hours,
        slots: {
          create: records.map((record) => ({
            ...record,
            isSelectedSlotLock: request.slotLockPositions.includes(record.position),
          })),
        },
        admins: { create: { userId: user.id, isOwner: true } },
      },
    });
    await this.sync.syncRoom(room.id, 'create');
    return this.rooms.getRoom(room.slug);
  }

  private async assertUnique(request: CreateRoomDto): Promise<void> {
    const conflict = await this.prisma.room.findFirst({
      where: { OR: [{ slug: request.slug }, { cheeseTrackerId: request.cheeseTrackerId }] },
    });
    if (conflict?.slug === request.slug) {
      throw new ConflictException('SLUG_TAKEN');
    }
    if (conflict) {
      throw new ConflictException('TRACKER_ALREADY_USED');
    }
  }
}
