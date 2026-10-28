import { Injectable, Logger, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';

import type { Room } from '../generated/prisma/client.js';
import { isGoaled } from '../locations/goal.logic.js';
import { evaluateSlotLockStates } from '../lock/lock.logic.js';
import type { UnlockTimeSource } from '../lock/lock.types.js';
import type { ChecksHistoryPoint } from '../lock/unlock-time.logic.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomUpdatesService } from '../rooms/room-updates.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { CheeseService } from '../sources/cheese/cheese.service.js';
import { SourceFormatError, SourceRequestError } from '../sources/http/source-errors.js';
import { checksHistoryPoints } from '../sync/room-source.mapper.js';
import type { RoomPaceDto, SlotTimelineDto } from './dto/pace.dto.js';
import {
  createSignalsReader,
  type SignalPeriod,
  type SignalSlot,
  type SignalSource,
  type SlotSignals,
} from './pace-signals.js';
import { CHECKS_HISTORY_CACHE_MINUTES, SNAPSHOT_BATCH_SIZE } from './pace.constants.js';
import { classifySlot, slotPaceRows, slotRange, type PaceLimits, type Segment, type SlotRange } from './pace.logic.js';
import {
  firstHistoryTime,
  gamePaceDtos,
  orderSnapshots,
  pacedSlots,
  slotHistory,
  slotPaceDtos,
  slotRangeLock,
  slotTimelineDto,
  type SnapshotEntry,
} from './pace.mapper.js';

export interface SlotPaceCalculation {
  range: SlotRange | null;
  segments: Segment[];
  signals: SlotSignals;
}

export interface PaceCalculation {
  key: string;
  result: RoomPaceDto;
  slots: Map<number, SlotPaceCalculation>;
  unreadableSnapshots: SignalPeriod[];
}

interface CachedChecksHistory {
  fetchedAt: number;
  points: ChecksHistoryPoint[];
}

interface RoomSignals {
  signals: Map<number, SlotSignals>;
  unreadableSnapshots: SignalPeriod[];
}

const SIGNAL_SOURCES: SignalSource[] = ['cheese', 'ap_tracker'];
const NO_SIGNALS: SlotSignals = {
  progressionItemTimes: [],
  bkPeriods: [],
  playerPeriods: [],
  statusChanges: [],
  signalsFrom: null,
};
const MS_PER_MINUTE = 60_000;

@Injectable()
export class PaceService implements OnModuleInit {
  private readonly logger = new Logger(PaceService.name);
  private readonly calculations = new Map<number, PaceCalculation>();
  private readonly revisions = new Map<number, number>();
  private readonly checksHistories = new Map<number, CachedChecksHistory>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly updates: RoomUpdatesService,
    private readonly cheese: CheeseService,
  ) {}

  onModuleInit(): void {
    this.updates.onPublish((room) => this.invalidate(room.id));
  }

  async getRoomPace(slug: string): Promise<RoomPaceDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    return (await this.calculation(room)).result;
  }

  async getSlotTimeline(slug: string, slotId: number): Promise<SlotTimelineDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const calculation = await this.calculation(room);
    const slot = calculation.slots.get(slotId);
    const hasRange = calculation.result.slots.some((row) => row.slotId === slotId && row.hasRange);
    if (slot === undefined || slot.range === null || !hasRange) {
      throw new NotFoundException('SLOT_NOT_FOUND');
    }
    return slotTimelineDto({
      slotId,
      range: slot.range,
      segments: slot.segments,
      signals: slot.signals,
      unreadableSnapshots: calculation.unreadableSnapshots,
    });
  }

  async calculation(room: Room): Promise<PaceCalculation> {
    const key = this.cacheKey(room);
    const cached = this.calculations.get(room.id);
    if (cached?.key === key) {
      return cached;
    }
    const calculation = await this.calculate(room, key);
    this.calculations.set(room.id, calculation);
    return calculation;
  }

  private invalidate(roomId: number): void {
    this.revisions.set(roomId, (this.revisions.get(roomId) ?? 0) + 1);
    this.calculations.delete(roomId);
  }

  private cacheKey(room: Room): string {
    return [
      room.id,
      this.revisions.get(room.id) ?? 0,
      room.lastSuccessfulSyncAt?.toISOString() ?? '',
      room.paceBreakLimitMinutes,
      room.paceBulkLimitChecks,
    ].join(':');
  }

  private async calculate(room: Room, key: string): Promise<PaceCalculation> {
    const history = await this.checksHistory(room);
    const now = new Date();
    const [slots, locks, unlocks] = await Promise.all([
      this.prisma.slot.findMany({ where: { roomId: room.id }, orderBy: { position: 'asc' } }),
      this.prisma.lockAssignment.findMany({ where: { roomId: room.id, notLocked: false } }),
      this.prisma.unlockItem.findMany({ where: { roomId: room.id } }),
    ]);
    const states = evaluateSlotLockStates(
      slots.map((slot) => slot.id),
      locks,
      unlocks.map((unlock) => ({ ...unlock, timeSource: unlock.timeSource as UnlockTimeSource })),
      new Set(slots.filter((slot) => slot.isStartSlot).map((slot) => slot.id)),
    );
    const { signals, unreadableSnapshots } = await this.readSignals(room, slots, now);
    const limits: PaceLimits = {
      breakLimitMinutes: room.paceBreakLimitMinutes,
      bulkLimitChecks: room.paceBulkLimitChecks,
    };
    const historyStart = firstHistoryTime(history);
    const slotCalculations = new Map<number, SlotPaceCalculation>();
    const paced = pacedSlots(slots);
    const rows = paced.flatMap((slot) => {
      const range = slotRange({
        lock: slotRangeLock(states.get(slot.id)),
        goalReached: isGoaled(slot),
        goalTime: slot.goalTime,
        firstHistoryTime: historyStart,
        now,
      });
      const input = {
        history: slotHistory(history, slot.cheeseGameId),
        range,
        signals: signals.get(slot.position) ?? NO_SIGNALS,
        limits,
        currentPlayer: { discordUserId: slot.discordUserId, discordName: slot.discordName },
      };
      slotCalculations.set(slot.id, { range, segments: classifySlot(input), signals: input.signals });
      return slotPaceDtos(slot, slotPaceRows(input));
    });
    const signalsFrom = signals.values().next().value?.signalsFrom ?? null;
    return {
      key,
      result: {
        calculatedAt: now.toISOString(),
        signalsFrom: signalsFrom?.toISOString() ?? null,
        limits,
        slots: rows,
        games: gamePaceDtos(paced, rows),
      },
      slots: slotCalculations,
      unreadableSnapshots,
    };
  }

  private async checksHistory(room: Room): Promise<ChecksHistoryPoint[]> {
    const cached = this.checksHistories.get(room.id);
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
    this.checksHistories.set(room.id, { fetchedAt: Date.now(), points });
    return points;
  }

  private async readSignals(room: Room, slots: SignalSlot[], now: Date): Promise<RoomSignals> {
    const [entries, runs] = await Promise.all([
      this.prisma.syncSnapshot.findMany({
        where: { roomId: room.id, source: { in: SIGNAL_SOURCES } },
        select: { id: true, source: true, firstSyncRunId: true },
      }),
      this.prisma.syncRun.findMany({ where: { roomId: room.id }, select: { id: true, startedAt: true } }),
    ]);
    const { snapshots, withoutRun } = orderSnapshots(
      entries as SnapshotEntry[],
      new Map(runs.map((run) => [run.id, run.startedAt])),
      now,
    );
    for (const id of withoutRun) {
      this.logger.warn(`Snapshot ${id} of room ${room.slug} has no synchronization run and is not used`);
    }
    const reader = createSignalsReader(slots);
    const unreadableSnapshots: SignalPeriod[] = [];
    for (let start = 0; start < snapshots.length; start += SNAPSHOT_BATCH_SIZE) {
      const batch = snapshots.slice(start, start + SNAPSHOT_BATCH_SIZE);
      const payloads = new Map(
        (
          await this.prisma.syncSnapshot.findMany({
            where: { id: { in: batch.map((snapshot) => snapshot.id) } },
            select: { id: true, payload: true },
          })
        ).map((row) => [row.id, row.payload]),
      );
      for (const snapshot of batch) {
        const result = reader.add({
          source: snapshot.source,
          validFrom: snapshot.from,
          payload: payloads.get(snapshot.id) ?? '',
        });
        if (!result.read) {
          this.logger.warn(
            `Snapshot ${snapshot.id} of room ${room.slug} cannot be read and is not used: ${result.error.message}`,
          );
          unreadableSnapshots.push({ from: snapshot.from, to: snapshot.to });
        }
        payloads.delete(snapshot.id);
      }
    }
    return { signals: reader.finish(now), unreadableSnapshots };
  }
}
