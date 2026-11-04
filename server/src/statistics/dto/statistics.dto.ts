import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional } from 'class-validator';

const toArray = ({ value }: { value: unknown }): unknown =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

export class HistoryQueryDto {
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  slotIds?: number[];
}

export class HistoryBucketDto {
  @ApiProperty({ type: String, format: 'date-time' })
  time: string;

  checks: number;
  newChecks: number;
  activeSlots: number;
  activePlayers: number;
}

export class SlotHistoryDto {
  slotId: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  firstCheckTime: string | null;

  recentChecks: number;
}

export class RoomHistoryDto {
  @ApiProperty({ type: String, format: 'date-time' })
  calculatedAt: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  historyFrom: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startedAt: string | null;

  bucketMinutes: number;
  rateWindowHours: number;

  @ApiProperty({ type: [HistoryBucketDto] })
  buckets: HistoryBucketDto[];

  @ApiProperty({ type: [SlotHistoryDto] })
  slots: SlotHistoryDto[];
}

export class BlockerDto {
  lockedSlotId: number;
  lockerSlotId: number;
  finderSlotId: number;
  locationName: string;
  sphere: number;
}

export class ProgressionFlowDto {
  finderSlotId: number;
  receiverSlotId: number;
  total: number;
  open: number;
}

export class SphereProgressDto {
  sphere: number;
  locationCount: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  doneAt: string | null;
}

export class RoomDependenciesDto {
  @ApiProperty({ type: String, format: 'date-time' })
  calculatedAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  seedUploadedAt: string;

  @ApiProperty({ type: [BlockerDto] })
  blockers: BlockerDto[];

  @ApiProperty({ type: [ProgressionFlowDto] })
  progressionFlow: ProgressionFlowDto[];

  @ApiProperty({ type: [SphereProgressDto] })
  spheres: SphereProgressDto[];
}
