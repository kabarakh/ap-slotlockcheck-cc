import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RoomAdminDto {
  userId: number;
  discordId: string;
  name: string;
  isOwner: boolean;
}

export class AddRoomAdminDto {
  @Matches(/^\d{5,20}$/)
  discordId: string;
}

export class UpdateRoomSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  yellowLimitHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  redLimitHours?: number;

  @IsOptional()
  @IsBoolean()
  useCheeseLimits?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  slotLockPositions?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sphereOffset?: number;

  @IsOptional()
  @IsBoolean()
  visitorsSeeLocations?: boolean;

  @IsOptional()
  @IsBoolean()
  playersMarkFiller?: boolean;
}

export const LOCK_SOURCES = ['detected', 'admin'] as const;

export class LockAssignmentDto {
  lockerSlotId: number;
  lockedSlotId: number;

  @ApiProperty({ enum: LOCK_SOURCES, enumName: 'LockSource' })
  source: (typeof LOCK_SOURCES)[number];

  notLocked: boolean;
}

export class SetLockAssignmentDto {
  @IsInt()
  lockerSlotId: number;

  @IsInt()
  lockedSlotId: number;

  @IsBoolean()
  locked: boolean;
}

export class ResetLockAssignmentDto {
  @IsInt()
  lockerSlotId: number;

  @IsInt()
  lockedSlotId: number;
}
