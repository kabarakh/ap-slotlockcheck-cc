import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, Room } from '../generated/prisma/client.js';
import { LiveGateway } from '../live/live.gateway.js';
import { detectLocks } from '../lock/lock.logic.js';
import type { LockDetectionResult } from '../lock/lock.types.js';
import { estimateUnlockTime } from '../lock/unlock-time.logic.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { CheeseService } from '../sources/cheese/cheese.service.js';
import {
  checksHistoryPoints,
  lockedSlotNamesByPosition,
  receivedItemsByPosition,
  archipelagoNamesByPosition,
  slotIdentity,
  slotRecordsFromCheese,
} from './room-source.mapper.js';
import { RoomSourceService, type RoomSource } from './room-source.service.js';
import { diffRoster } from './roster.diff.js';

export type SyncTrigger = 'schedule' | 'manual' | 'create';
export type SyncOutcome = 'success' | 'failed' | 'skipped';

type SlotIdByPosition = Map<number, number>;

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly roomSource: RoomSourceService,
    private readonly cheese: CheeseService,
    private readonly live: LiveGateway,
  ) {}

  async syncRoom(roomId: number, trigger: SyncTrigger): Promise<SyncOutcome> {
    if (this.rooms.isSyncRunning(roomId)) {
      return 'skipped';
    }
    this.rooms.markSyncRunning(roomId, true);
    const startedAt = new Date();
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const run = await this.prisma.syncRun.create({ data: { roomId, trigger, startedAt, result: 'running' } });
    try {
      const before = await this.rooms.getRosterForRoom(roomId);
      const source = await this.roomSource.fetch(room.cheeseTrackerId);
      await this.saveSnapshots(roomId, run.id, source);
      const isFirstSync = room.lastSuccessfulSyncAt === null;
      await this.applySource(room, source, startedAt, isFirstSync);
      if (isFirstSync) {
        await this.estimateUnknownUnlockTimes(room);
      }
      await this.prisma.syncRun.update({ where: { id: run.id }, data: { finishedAt: new Date(), result: 'success' } });
      this.rooms.markSyncRunning(roomId, false);
      const updatedRoom = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
      const after = await this.rooms.getRosterForRoom(roomId);
      this.live.publishSynced({
        slug: room.slug,
        room: this.rooms.toDetail(updatedRoom, after),
        ...diffRoster(before, after),
      });
      return 'success';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Synchronization of room ${room.slug} failed: ${message}`);
      await this.prisma.syncRun.update({
        where: { id: run.id },
        data: { finishedAt: new Date(), result: 'failed', error: message },
      });
      const failedRoom = await this.prisma.room.update({
        where: { id: roomId },
        data: { lastSyncAt: startedAt, lastSyncError: message },
      });
      this.rooms.markSyncRunning(roomId, false);
      this.live.publishSyncFailed({ slug: room.slug, syncStatus: this.rooms.toSyncStatus(failedRoom) });
      return 'failed';
    } finally {
      this.rooms.markSyncRunning(roomId, false);
    }
  }

  private async saveSnapshots(roomId: number, syncRunId: number, source: RoomSource): Promise<void> {
    const payloads: Record<string, unknown> = {
      cheese: source.cheese,
      ap_tracker: source.tracker,
      ap_static: source.staticTracker,
      ap_slot_data: source.slotData,
    };
    for (const [sourceName, payload] of Object.entries(payloads)) {
      const json = JSON.stringify(payload);
      const hash = createHash('sha256').update(json).digest('hex');
      const last = await this.prisma.syncSnapshot.findFirst({
        where: { roomId, source: sourceName },
        orderBy: { id: 'desc' },
      });
      if (last?.hash === hash) {
        await this.prisma.syncSnapshot.update({ where: { id: last.id }, data: { lastSyncRunId: syncRunId } });
      } else {
        await this.prisma.syncSnapshot.create({
          data: {
            roomId,
            source: sourceName,
            hash,
            payload: json,
            firstSyncRunId: syncRunId,
            lastSyncRunId: syncRunId,
          },
        });
      }
    }
  }

  private async applySource(room: Room, source: RoomSource, now: Date, isFirstSync: boolean): Promise<void> {
    const records = slotRecordsFromCheese(source.cheese, archipelagoNamesByPosition(source.roomStatus, source.tracker));
    await this.prisma.$transaction(async (tx) => {
      await tx.slot.deleteMany({
        where: { roomId: room.id, position: { notIn: records.map((record) => record.position) } },
      });
      for (const record of records) {
        await tx.slot.upsert({
          where: { roomId_position: { roomId: room.id, position: record.position } },
          create: { roomId: room.id, ...record },
          update: record,
        });
      }
      const slots = await tx.slot.findMany({ where: { roomId: room.id } });
      const slotIdByPosition: SlotIdByPosition = new Map(slots.map((slot) => [slot.position, slot.id]));
      const selectedPositions = slots.filter((slot) => slot.isSelectedSlotLock).map((slot) => slot.position);
      const detection = detectLocks({
        slots: records.map(slotIdentity),
        slotLockPositions: selectedPositions,
        lockedSlotNamesByLocker: lockedSlotNamesByPosition(source.slotData, selectedPositions),
        receivedItemsByLocker: receivedItemsByPosition(source.tracker, selectedPositions, source.slotLockItemNames),
        overrides: [],
      });
      await this.storeDetectedLocks(tx, room.id, detection, slotIdByPosition);
      await this.storeNewUnlocks(tx, room.id, detection, slotIdByPosition, now, isFirstSync);
      await tx.room.update({
        where: { id: room.id },
        data: {
          archipelagoOrigin: source.archipelagoOrigin,
          archipelagoTrackerId: source.archipelagoTrackerId,
          archipelagoRoomId: source.archipelagoRoomId,
          ownerCtUserId: source.cheese.owner_ct_user_id ?? null,
          ownerDiscordName: source.cheese.owner_discord_username ?? null,
          ...(room.limitsOverridden
            ? {}
            : {
                yellowLimitHours: source.cheese.inactivity_threshold_yellow_hours,
                redLimitHours: source.cheese.inactivity_threshold_red_hours,
              }),
          unknownSlotNames: JSON.stringify(detection.unknownSlotNames),
          lastSyncAt: now,
          lastSuccessfulSyncAt: now,
          lastSyncError: null,
        },
      });
    });
  }

  private async storeDetectedLocks(
    tx: Prisma.TransactionClient,
    roomId: number,
    detection: LockDetectionResult,
    slotIdByPosition: SlotIdByPosition,
  ): Promise<void> {
    const existing = await tx.lockAssignment.findMany({ where: { roomId } });
    const detectedKeys = new Set<string>();
    for (const assignment of detection.assignments) {
      const lockerSlotId = slotIdByPosition.get(assignment.lockerPosition);
      const lockedSlotId = slotIdByPosition.get(assignment.lockedPosition);
      if (lockerSlotId === undefined || lockedSlotId === undefined) {
        continue;
      }
      detectedKeys.add(`${lockerSlotId}:${lockedSlotId}`);
      const row = existing.find((lock) => lock.lockerSlotId === lockerSlotId && lock.lockedSlotId === lockedSlotId);
      if (!row) {
        await tx.lockAssignment.create({ data: { roomId, lockerSlotId, lockedSlotId, source: 'detected' } });
      }
    }
    const obsolete = existing.filter(
      (lock) => lock.source === 'detected' && !detectedKeys.has(`${lock.lockerSlotId}:${lock.lockedSlotId}`),
    );
    if (obsolete.length > 0) {
      await tx.lockAssignment.deleteMany({ where: { id: { in: obsolete.map((lock) => lock.id) } } });
    }
  }

  private async storeNewUnlocks(
    tx: Prisma.TransactionClient,
    roomId: number,
    detection: LockDetectionResult,
    slotIdByPosition: SlotIdByPosition,
    now: Date,
    isFirstSync: boolean,
  ): Promise<void> {
    const existing = await tx.unlockItem.findMany({ where: { roomId } });
    for (const item of detection.firstUnlockItems) {
      const lockerSlotId = slotIdByPosition.get(item.lockerPosition);
      const lockedSlotId = slotIdByPosition.get(item.lockedPosition);
      if (lockerSlotId === undefined || lockedSlotId === undefined) {
        continue;
      }
      if (existing.some((unlock) => unlock.lockerSlotId === lockerSlotId && unlock.lockedSlotId === lockedSlotId)) {
        continue;
      }
      await tx.unlockItem.create({
        data: {
          roomId,
          lockerSlotId,
          lockedSlotId,
          senderSlotId: slotIdByPosition.get(item.senderPosition) ?? null,
          firstSeenAt: now,
          unlockTime: isFirstSync ? null : now,
          timeSource: isFirstSync ? 'unknown' : 'sync',
        },
      });
    }
  }

  private async estimateUnknownUnlockTimes(room: Room): Promise<void> {
    const unknown = await this.prisma.unlockItem.findMany({
      where: { roomId: room.id, timeSource: 'unknown' },
      include: { lockedSlot: true },
    });
    if (unknown.length === 0) {
      return;
    }
    let history;
    try {
      history = checksHistoryPoints(await this.cheese.getChecksHistory(room.cheeseTrackerId));
    } catch (error) {
      this.logger.warn(`Checks history of room ${room.slug} not available: ${String(error)}`);
      return;
    }
    for (const unlock of unknown) {
      const estimate = estimateUnlockTime(history, String(unlock.lockedSlot.cheeseGameId));
      if (estimate) {
        await this.prisma.unlockItem.update({
          where: { id: unlock.id },
          data: { unlockTime: estimate, timeSource: 'estimated' },
        });
      }
    }
  }
}
