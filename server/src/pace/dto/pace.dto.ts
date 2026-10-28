import { ApiProperty } from '@nestjs/swagger';

import type { SlotStartKind } from '../pace.logic.js';

export const SLOT_START_KINDS: SlotStartKind[] = ['unlock', 'estimated', 'history_start', 'unknown'];

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
