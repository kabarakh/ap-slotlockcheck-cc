import { Injectable, NotFoundException } from '@nestjs/common';

import { isGoaled } from '../locations/goal.logic.js';
import { ChecksHistoryService } from '../pace/checks-history.service.js';
import { pacedSlots } from '../pace/pace.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { roomNow } from '../rooms/archive.logic.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { blockerRows, progressionFlow, sphereProgress, type DependencySlot } from './dependencies.logic.js';
import type { RoomDependenciesDto, RoomHistoryDto } from './dto/statistics.dto.js';
import { HISTORY_BUCKET_MINUTES, RATE_WINDOW_HOURS, roomHistory } from './history.logic.js';

const toIso = (date: Date | null): string | null => date?.toISOString() ?? null;

@Injectable()
export class StatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly checksHistory: ChecksHistoryService,
  ) {}

  async getHistory(slug: string): Promise<RoomHistoryDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const history = await this.checksHistory.get(room);
    const slots = await this.prisma.slot.findMany({ where: { roomId: room.id }, orderBy: { position: 'asc' } });
    const now = roomNow(room, new Date());
    const result = roomHistory({
      history,
      slots: pacedSlots(slots),
      bulkLimitChecks: room.paceBulkLimitChecks,
      now,
    });
    return {
      calculatedAt: now.toISOString(),
      historyFrom: toIso(result.historyFrom),
      startedAt: toIso(result.startedAt),
      bucketMinutes: HISTORY_BUCKET_MINUTES,
      rateWindowHours: RATE_WINDOW_HOURS,
      buckets: result.buckets.map((bucket) => ({ ...bucket, time: bucket.time.toISOString() })),
      slots: result.slots.map((slot) => ({ ...slot, firstCheckTime: toIso(slot.firstCheckTime) })),
    };
  }

  async getDependencies(slug: string): Promise<RoomDependenciesDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const seed = await this.prisma.seedData.findUnique({ where: { roomId: room.id } });
    if (seed === null) {
      throw new NotFoundException('SEED_NOT_FOUND');
    }
    const roomId = room.id;
    const [slotRecords, locks, unlocks] = await Promise.all([
      this.prisma.slot.findMany({ where: { roomId } }),
      this.prisma.lockAssignment.findMany({ where: { roomId, notLocked: false } }),
      this.prisma.unlockItem.findMany({ where: { roomId } }),
    ]);
    const slots: DependencySlot[] = slotRecords.map((slot) => ({
      id: slot.id,
      name: slot.name,
      archipelagoName: slot.archipelagoName,
      isSelectedSlotLock: slot.isSelectedSlotLock,
      goaled: isGoaled(slot),
      goalTime: slot.goalTime,
    }));
    const lockerIds = slots.filter((slot) => slot.isSelectedSlotLock).map((slot) => slot.id);
    const sphereGroupsOf = (fillerMarked: boolean) =>
      this.prisma.seedLocation
        .groupBy({
          by: ['sphere', 'finderSlotId', 'checked'],
          where: { roomId, fillerMarkedAt: fillerMarked ? { not: null } : null },
          _count: { _all: true },
          _max: { checkedFirstSeenAt: true, fillerMarkedAt: true },
        })
        .then((groups) =>
          groups.map((group) => ({
            sphere: group.sphere,
            finderSlotId: group.finderSlotId,
            checked: group.checked,
            fillerMarked,
            count: group._count._all,
            latestCheckedAt: group._max.checkedFirstSeenAt,
            latestFillerMarkAt: group._max.fillerMarkedAt,
          })),
        );
    const [openUnlockLocations, progressionGroups, sphereGroups] = await Promise.all([
      this.prisma.seedLocation.findMany({
        where: { roomId, checked: false, receiverSlotId: { in: lockerIds }, itemName: { startsWith: 'Unlock ' } },
        select: { finderSlotId: true, receiverSlotId: true, itemName: true, locationName: true, sphere: true },
      }),
      this.prisma.seedLocation.groupBy({
        by: ['finderSlotId', 'receiverSlotId', 'checked'],
        where: { roomId, itemType: 'progression', receiverSlotId: { not: null } },
        _count: { _all: true },
      }),
      Promise.all([sphereGroupsOf(false), sphereGroupsOf(true)]).then((groups) => groups.flat()),
    ]);
    return {
      calculatedAt: roomNow(room, new Date()).toISOString(),
      seedUploadedAt: seed.uploadedAt.toISOString(),
      blockers: blockerRows(slots, locks, unlocks, openUnlockLocations),
      progressionFlow: progressionFlow(
        progressionGroups.map((group) => ({
          finderSlotId: group.finderSlotId,
          receiverSlotId: group.receiverSlotId,
          checked: group.checked,
          count: group._count._all,
        })),
      ),
      spheres: sphereProgress(sphereGroups, slots, seed.uploadedAt).map((row) => ({
        ...row,
        doneAt: toIso(row.doneAt),
      })),
    };
  }
}
