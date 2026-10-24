import { ApiProperty } from '@nestjs/swagger';

export class SyncStatusDto {
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSyncAt: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastSuccessfulSyncAt: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastSyncError: string | null;

  running: boolean;
}

export class RoomSummaryDto {
  id: number;
  slug: string;
  title: string;
  slotCount: number;
  lockedSlotCount: number;
  unlockedSlotCount: number;
  unlockedPercentage: number;
  syncStatus: SyncStatusDto;
}

export class RoomDetailDto extends RoomSummaryDto {
  cheeseTrackerId: string;
  cheeseTrackerUrl: string;
  archipelagoTrackerUrl: string;
  yellowLimitHours: number;
  redLimitHours: number;
  limitsOverridden: boolean;
  unknownSlotNames: string[];
  manualSyncCooldownSeconds: number;
}

export const ROOM_ROLES = ['visitor', 'player', 'admin'] as const;
export type RoomRole = (typeof ROOM_ROLES)[number];

export class RoomMembershipDto {
  @ApiProperty({ enum: ROOM_ROLES, enumName: 'RoomRole' })
  role: RoomRole;

  isOwner: boolean;
}
