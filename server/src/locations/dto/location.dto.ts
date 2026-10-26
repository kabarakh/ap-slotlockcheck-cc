import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ITEM_TYPES, type ItemType } from '../../seed/item-type.js';

export const LOCATION_STATES = ['open', 'found', 'filler'] as const;
export type LocationState = (typeof LOCATION_STATES)[number];

export const LOCATION_SLOT_SCOPES = ['all', 'mine', 'selected'] as const;
export type LocationSlotScope = (typeof LOCATION_SLOT_SCOPES)[number];

export const LOCATION_SORT_FIELDS = ['sphere', 'finder', 'location', 'game', 'receiver', 'item'] as const;
export type LocationSortField = (typeof LOCATION_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const MAXIMUM_PAGE_SIZE = 200;

const toArray = ({ value }: { value: unknown }): unknown =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value];

const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === undefined ? undefined : value === true || value === 'true';

export class SphereQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  excludeGoaled?: boolean;
}

export class LocationQueryDto extends SphereQueryDto {
  @ApiProperty({ enum: LOCATION_STATES, enumName: 'LocationState' })
  @IsIn(LOCATION_STATES)
  state: LocationState;

  @ApiProperty({ enum: LOCATION_SLOT_SCOPES, enumName: 'LocationSlotScope', required: false })
  @IsOptional()
  @IsIn(LOCATION_SLOT_SCOPES)
  slots?: LocationSlotScope;

  @ApiProperty({ type: [Number], required: false })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  slotIds?: number[];

  @ApiProperty({ enum: ITEM_TYPES, enumName: 'ItemType', isArray: true, required: false })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(ITEM_TYPES, { each: true })
  itemTypes?: ItemType[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fromSphere?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  toSphere?: number;

  @ApiProperty({ enum: LOCATION_SORT_FIELDS, enumName: 'LocationSortField', required: false })
  @IsOptional()
  @IsIn(LOCATION_SORT_FIELDS)
  sort?: LocationSortField;

  @ApiProperty({ enum: SORT_ORDERS, enumName: 'SortOrder', required: false })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAXIMUM_PAGE_SIZE)
  limit?: number;
}

export class SphereRowDto {
  sphere: number;
  open: number;
  found: number;
  total: number;
}

export class SphereItemTypesDto {
  sphere: number;
  progression: number;
  useful: number;
  normal: number;
  trap: number;
}

export class SphereOverviewDto {
  @ApiProperty({ type: Number, nullable: true })
  lowestOpenSphere: number | null;

  visibleMaxSphere: number;
  sphereCount: number;

  @ApiProperty({ type: [SphereRowDto] })
  spheres: SphereRowDto[];

  @ApiProperty({ type: [SphereItemTypesDto], nullable: true })
  itemTypes: SphereItemTypesDto[] | null;
}

export class LocationUserRowDto {
  id: number;
  sphere: number;
  finderSlotId: number;
  finderName: string;

  @ApiProperty({ type: String, nullable: true })
  discordName: string | null;

  game: string;
  locationName: string;
  fillerMarked: boolean;
  canMarkFiller: boolean;
}

export class LocationAdminRowDto extends LocationUserRowDto {
  receiverName: string;
  itemName: string;

  @ApiProperty({ enum: ITEM_TYPES, enumName: 'ItemType' })
  itemType: ItemType;

  @ApiProperty({ type: String, nullable: true })
  fillerMarkedByName: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  fillerMarkedAt: string | null;
}

export class LocationUserPageDto {
  total: number;

  @ApiProperty({ type: [LocationUserRowDto] })
  rows: LocationUserRowDto[];
}

export class LocationAdminPageDto {
  total: number;

  @ApiProperty({ type: [LocationAdminRowDto] })
  rows: LocationAdminRowDto[];
}

export const CLEANUP_SLOT_MODES = ['all', 'progression'] as const;

export class SphereCleanupQueryDto extends SphereQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fromSphere: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  toSphere: number;

  @ApiProperty({ enum: CLEANUP_SLOT_MODES, enumName: 'CleanupSlotMode', required: false })
  @IsOptional()
  @IsIn(CLEANUP_SLOT_MODES)
  slots?: (typeof CLEANUP_SLOT_MODES)[number];
}

export class SphereCleanupEntryDto {
  lowestSphere: number;
  slotId: number;
  slotName: string;

  @ApiProperty({ type: String, nullable: true })
  discordUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  discordName: string | null;

  progression: number;
  useful: number;
  normal: number;
  trap: number;
}

export class SphereCleanupDto {
  fromSphere: number;
  toSphere: number;

  @ApiProperty({ type: [SphereCleanupEntryDto] })
  entries: SphereCleanupEntryDto[];
}
