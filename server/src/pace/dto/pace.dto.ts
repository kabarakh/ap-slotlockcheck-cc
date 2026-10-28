import { ApiProperty } from '@nestjs/swagger';

import { PROGRESSION_STATUSES } from '../../rooms/dto/slot-row.dto.js';
import type { ProgressionStatus } from '../../sources/cheese/cheese.schemas.js';
import type { SegmentKind, SlotStartKind } from '../pace.logic.js';

export const SLOT_START_KINDS: SlotStartKind[] = ['unlock', 'estimated', 'history_start', 'unknown'];
export const SEGMENT_KINDS: SegmentKind[] = ['locked', 'active', 'pause', 'bk', 'break', 'bulk', 'after_goal'];

export class PaceLimitsDto {
  breakLimitMinutes: number;
  bulkLimitChecks: number;
}

export class SlotPaceDto {
  slotId: number;
  name: string;
  game: string;
  hasRange: boolean;

  @ApiProperty({ type: String, nullable: true })
  discordUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  discordName: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  from: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  to: string | null;

  @ApiProperty({ type: Number, nullable: true })
  activeMinutes: number | null;

  @ApiProperty({ type: Number, nullable: true })
  checks: number | null;

  @ApiProperty({ type: Number, nullable: true })
  checksPerHour: number | null;

  @ApiProperty({ type: Number, nullable: true })
  minutesPerCheck: number | null;

  @ApiProperty({ type: Number, nullable: true })
  bkMinutes: number | null;

  @ApiProperty({ type: Number, nullable: true })
  bkShare: number | null;

  @ApiProperty({ type: Number, nullable: true })
  bkCount: number | null;

  @ApiProperty({ type: Number, nullable: true })
  longestBkMinutes: number | null;

  @ApiProperty({ type: Number, nullable: true })
  breakMinutes: number | null;

  @ApiProperty({ enum: SLOT_START_KINDS, enumName: 'SlotStartKind', nullable: true })
  startKind: SlotStartKind | null;

  partialSignals: boolean;
}

export class GamePaceDto {
  game: string;
  slotCount: number;
  activeMinutes: number;
  checks: number;

  @ApiProperty({ type: Number, nullable: true })
  checksPerHour: number | null;

  @ApiProperty({ type: Number, nullable: true })
  medianChecksPerHour: number | null;
}

export class RoomPaceDto {
  @ApiProperty({ type: String, format: 'date-time' })
  calculatedAt: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  signalsFrom: string | null;

  @ApiProperty({ type: PaceLimitsDto })
  limits: PaceLimitsDto;

  @ApiProperty({ type: [SlotPaceDto] })
  slots: SlotPaceDto[];

  @ApiProperty({ type: [GamePaceDto] })
  games: GamePaceDto[];
}

export class TimePeriodDto {
  @ApiProperty({ type: String, format: 'date-time' })
  from: string;

  @ApiProperty({ type: String, format: 'date-time' })
  to: string;
}

export class SegmentDto extends TimePeriodDto {
  @ApiProperty({ enum: SEGMENT_KINDS, enumName: 'SegmentKind' })
  kind: SegmentKind;

  checks: number;
}

export class StatusChangeDto {
  @ApiProperty({ type: String, format: 'date-time' })
  time: string;

  @ApiProperty({ enum: PROGRESSION_STATUSES, enumName: 'ProgressionStatus' })
  status: ProgressionStatus;
}

export class TimelinePlayerPeriodDto extends TimePeriodDto {
  @ApiProperty({ type: String, nullable: true })
  discordUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  discordName: string | null;
}

export class SlotTimelineDto {
  slotId: number;

  @ApiProperty({ type: String, format: 'date-time' })
  from: string;

  @ApiProperty({ type: String, format: 'date-time' })
  to: string;

  @ApiProperty({ type: [SegmentDto] })
  segments: SegmentDto[];

  @ApiProperty({ type: String, format: 'date-time', isArray: true })
  progressionItemTimes: string[];

  @ApiProperty({ type: [StatusChangeDto] })
  statusChanges: StatusChangeDto[];

  @ApiProperty({ type: [TimelinePlayerPeriodDto] })
  playerPeriods: TimelinePlayerPeriodDto[];

  @ApiProperty({ type: [TimePeriodDto] })
  unreadableSnapshots: TimePeriodDto[];
}
