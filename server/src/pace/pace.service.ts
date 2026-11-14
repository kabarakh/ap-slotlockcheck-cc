import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';

import type { Room } from '../generated/prisma/client.js';
import { isGoaled } from '../locations/goal.logic.js';
import { evaluateSlotLockStates } from '../lock/lock.logic.js';
import type { UnlockTimeSource } from '../lock/lock.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { roomNow } from '../rooms/archive.logic.js';
import { RoomUpdatesService } from '../rooms/room-updates.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { ChecksHistoryService } from './checks-history.service.js';
import type { RoomPaceDto, SlotTimelineDto } from './dto/pace.dto.js';
import { noLogicPeriods, type LogicLocation } from './logic-periods.logic.js';
import { finishSignals, syncGaps, type SignalPeriod, type SlotSignals } from './pace-signals.js';
import { PaceSignalsService, unreadablePeriods } from './pace-signals.service.js';
import {
  bkSignalsFrom,
  classifySlot,
  slotPaceRows,
  slotRange,
  type NoLogicSignals,
  type PaceLimits,
  type Segment,
  type SlotRange,
} from './pace.logic.js';
import {
  firstHistoryTime,
  gamePaceDtos,
  pacedSlots,
  slotHistory,
  slotPaceDtos,
  slotRangeLock,
  slotTimelineDto,
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

interface SeedLogic {
  from: Date;
  unreachableSphere: number;
  ownLocations: Map<number, LogicLocation[]>;
  progressionItems: Map<number, LogicLocation[]>;
}

const NO_SIGNALS: SlotSignals = {
  bkPeriods: [],
  playerPeriods: [],
  statusChanges: [],
  signalsFrom: null,
};
@Injectable()
export class PaceService implements OnModuleInit {
  private readonly calculations = new Map<number, PaceCalculation>();
  private readonly revisions = new Map<number, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly updates: RoomUpdatesService,
    private readonly checksHistory: ChecksHistoryService,
    private readonly paceSignals: PaceSignalsService,
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

  private async seedLogic(roomId: number): Promise<SeedLogic | null> {
    const seed = await this.prisma.seedData.findUnique({
      where: { roomId },
      select: { uploadedAt: true, sphereCount: true },
    });
    if (seed === null) {
      return null;
    }
    const locations = await this.prisma.seedLocation.findMany({
      where: { roomId },
      select: {
        finderSlotId: true,
        receiverSlotId: true,
        itemType: true,
        sphere: true,
        checked: true,
        checkedFirstSeenAt: true,
      },
    });
    const ownLocations = new Map<number, LogicLocation[]>();
    const progressionItems = new Map<number, LogicLocation[]>();
    const add = (lists: Map<number, LogicLocation[]>, slotId: number, location: LogicLocation) => {
      const list = lists.get(slotId) ?? [];
      list.push(location);
      lists.set(slotId, list);
    };
    for (const location of locations) {
      const logicLocation = {
        sphere: location.sphere,
        checkedAt: location.checked ? (location.checkedFirstSeenAt ?? seed.uploadedAt) : null,
      };
      add(ownLocations, location.finderSlotId, logicLocation);
      if (location.itemType === 'progression' && location.receiverSlotId !== null) {
        add(progressionItems, location.receiverSlotId, logicLocation);
      }
    }
    return { from: seed.uploadedAt, unreachableSphere: seed.sphereCount, ownLocations, progressionItems };
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
      room.archivedAt?.toISOString() ?? '',
    ].join(':');
  }

  private async calculate(room: Room, key: string): Promise<PaceCalculation> {
    const history = await this.checksHistory.get(room);
    const now = roomNow(room, new Date());
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
    const stored = await this.paceSignals.updateSignals(room);
    const signals = finishSignals(stored.state, slots, now);
    const dataGaps = syncGaps(stored.state, now);
    const seedLogic = await this.seedLogic(room.id);
    const noLogicOf = (slotId: number): NoLogicSignals | null =>
      seedLogic === null
        ? null
        : {
            from: seedLogic.from,
            periods: noLogicPeriods({
              ownLocations: seedLogic.ownLocations.get(slotId) ?? [],
              progressionItems: seedLogic.progressionItems.get(slotId) ?? [],
              unreachableSphere: seedLogic.unreachableSphere,
              from: seedLogic.from,
              to: now,
            }),
          };
    const unreadableSnapshots = unreadablePeriods(stored.unreadableSnapshots, now);
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
        noLogic: range === null ? null : noLogicOf(slot.id),
        dataGaps,
        limits,
        currentPlayer: { discordUserId: slot.discordUserId, discordName: slot.discordName },
        now,
      };
      slotCalculations.set(slot.id, { range, segments: classifySlot(input), signals: input.signals });
      return slotPaceDtos(slot, slotPaceRows(input));
    });
    const signalsFrom = bkSignalsFrom(
      signals.values().next().value ?? NO_SIGNALS,
      seedLogic === null ? null : { from: seedLogic.from, periods: [] },
    );
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
}
