import { ApiProperty } from '@nestjs/swagger';
import type { LockStatus, UnlockTimeSource } from '../../lock/lock.types.js';
import type {
  AvailabilityStatus,
  CompletionStatus,
  ProgressionStatus,
  TrackerStatus,
} from '../../sources/cheese/cheese.schemas.js';

export const LOCK_STATUSES: LockStatus[] = ['not_locked', 'start_slot', 'locked', 'partially_unlocked', 'unlocked'];
export const UNLOCK_TIME_SOURCES: UnlockTimeSource[] = ['sync', 'estimated', 'manual', 'csv', 'unknown'];
export const TRACKER_STATUSES: TrackerStatus[] = ['disconnected', 'connected', 'ready', 'playing', 'goal_completed'];
export const PROGRESSION_STATUSES: ProgressionStatus[] = ['unknown', 'unblocked', 'bk', 'go', 'soft_bk'];
export const COMPLETION_STATUSES: CompletionStatus[] = ['incomplete', 'all_checks', 'goal', 'done', 'released'];
export const AVAILABILITY_STATUSES: AvailabilityStatus[] = ['unknown', 'open', 'claimed', 'public'];

export class SlotLockDto {
  lockerSlotId: number;
  lockerName: string;
  unlocked: boolean;

  @ApiProperty({ type: Number, nullable: true })
  senderSlotId: number | null;

  @ApiProperty({ type: String, nullable: true })
  senderName: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  unlockTime: string | null;

  @ApiProperty({ enum: UNLOCK_TIME_SOURCES, enumName: 'UnlockTimeSource', nullable: true })
  timeSource: UnlockTimeSource | null;
}

export class SlotRowDto {
  id: number;
  position: number;
  name: string;

  @ApiProperty({ type: String, nullable: true })
  archipelagoName: string | null;

  archipelagoGoal: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archipelagoActivity: string | null;

  game: string;

  @ApiProperty({ type: String, nullable: true })
  discordUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  discordName: string | null;

  checksDone: number;
  checksTotal: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastActivity: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastChecked: string | null;

  @ApiProperty({ enum: TRACKER_STATUSES, enumName: 'TrackerStatus' })
  trackerStatus: TrackerStatus;

  @ApiProperty({ enum: PROGRESSION_STATUSES, enumName: 'ProgressionStatus' })
  progressionStatus: ProgressionStatus;

  @ApiProperty({ enum: COMPLETION_STATUSES, enumName: 'CompletionStatus' })
  completionStatus: CompletionStatus;

  @ApiProperty({ enum: AVAILABILITY_STATUSES, enumName: 'AvailabilityStatus' })
  availabilityStatus: AvailabilityStatus;

  notes: string;
  isSlotLock: boolean;
  isSelectedSlotLock: boolean;

  @ApiProperty({ enum: LOCK_STATUSES, enumName: 'LockStatus' })
  lockStatus: LockStatus;

  @ApiProperty({ type: [SlotLockDto] })
  locks: SlotLockDto[];

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  unlockTime: string | null;

  @ApiProperty({ enum: UNLOCK_TIME_SOURCES, enumName: 'UnlockTimeSource', nullable: true })
  unlockTimeSource: UnlockTimeSource | null;

  warningCount: number;
  unlocksSent: number;
}
