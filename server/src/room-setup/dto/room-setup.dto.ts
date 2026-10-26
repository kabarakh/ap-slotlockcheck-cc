import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { CHEESE_TRACKER_ID_PATTERN } from '../../sources/cheese/cheese.schemas.js';

export const ROOM_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export class RoomPreviewRequestDto {
  @Matches(CHEESE_TRACKER_ID_PATTERN)
  cheeseTrackerId: string;
}

export class SlotLockCandidateDto {
  position: number;
  name: string;
}

export const OWNER_CHECK_RESULTS = ['slot', 'name', 'failed'] as const;

export class RoomPreviewDto {
  cheeseTrackerId: string;
  title: string;
  suggestedSlug: string;

  @ApiProperty({ enum: OWNER_CHECK_RESULTS, enumName: 'OwnerCheckResult' })
  ownerCheck: (typeof OWNER_CHECK_RESULTS)[number];

  @ApiProperty({ type: String, nullable: true })
  ownerDiscordName: string | null;

  @ApiProperty({ type: String, nullable: true })
  existingSlug: string | null;

  @ApiProperty({ type: [SlotLockCandidateDto] })
  slotLockSlots: SlotLockCandidateDto[];
}

export class CreateRoomDto {
  @Matches(CHEESE_TRACKER_ID_PATTERN)
  cheeseTrackerId: string;

  @Matches(ROOM_SLUG_PATTERN)
  slug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  slotLockPositions: number[];
}
