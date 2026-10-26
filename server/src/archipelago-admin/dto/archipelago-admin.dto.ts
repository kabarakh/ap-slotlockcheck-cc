import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const RELEASE_MODES = ['all', 'filler', 'marked'] as const;
export type ReleaseMode = (typeof RELEASE_MODES)[number];

export const SERVER_JOB_STATES = ['running', 'done', 'failed', 'stopped'] as const;

export const MAXIMUM_LOCATIONS_FOR_ONE_RUN = 20000;

export class ServerLoginDto {
  @IsOptional()
  @IsInt()
  slotId?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  serverPassword: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  roomPassword?: string;
}

export class ServerJobDto {
  id: string;
  command: string;
  total: number;
  done: number;
  errors: string[];

  @ApiProperty({ enum: SERVER_JOB_STATES, enumName: 'ServerJobState' })
  state: (typeof SERVER_JOB_STATES)[number];

  @ApiProperty({ type: String, format: 'date-time' })
  startedAt: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finishedAt: string | null;
}

export class ServerAdminStatusDto {
  loggedIn: boolean;

  @ApiProperty({ type: Number, nullable: true })
  slotId: number | null;

  @ApiProperty({ type: ServerJobDto, nullable: true })
  job: ServerJobDto | null;
}

export class SendLocationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAXIMUM_LOCATIONS_FOR_ONE_RUN)
  @IsInt({ each: true })
  locationIds: number[];
}

export class SendItemDto {
  @IsInt()
  slotId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  itemName: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  amount: number;
}

export class SlotCommandDto {
  @IsInt()
  slotId: number;
}

export class ReleaseSpheresDto {
  @IsInt()
  @Min(0)
  fromSphere: number;

  @IsInt()
  @Min(0)
  toSphere: number;

  @ApiProperty({ enum: RELEASE_MODES, enumName: 'ReleaseMode' })
  @IsIn(RELEASE_MODES)
  mode: ReleaseMode;
}

export class ReleaseSpheresQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fromSphere: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  toSphere: number;

  @ApiProperty({ enum: RELEASE_MODES, enumName: 'ReleaseMode' })
  @IsIn(RELEASE_MODES)
  mode: ReleaseMode;
}

export class ReleasePreviewDto {
  locationCount: number;
  progressionCount: number;
}

export class ItemNamesQueryDto {
  @Type(() => Number)
  @IsInt()
  slotId: number;
}

export class ItemNamesDto {
  itemNames: string[];
}
