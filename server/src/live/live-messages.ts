import { ApiProperty } from '@nestjs/swagger';
import { RoomDetailDto, RoomSummaryDto, SyncStatusDto } from '../rooms/dto/room.dto.js';
import { SlotRowDto } from '../rooms/dto/slot-row.dto.js';

export enum LiveMessageName {
  RoomJoin = 'room:join',
  RoomLeave = 'room:leave',
  RoomSynced = 'room:synced',
  RoomSyncFailed = 'room:sync-failed',
  RoomUpdated = 'room:updated',
}

export class RoomSyncedPayloadDto {
  slug: string;
  room: RoomSummaryDto;

  @ApiProperty({ type: [SlotRowDto] })
  changedSlots: SlotRowDto[];

  removedSlotIds: number[];
}

export class RoomSyncFailedPayloadDto {
  slug: string;
  syncStatus: SyncStatusDto;
}

export class RoomUpdatedPayloadDto {
  slug: string;
  room: RoomDetailDto;

  @ApiProperty({ type: [SlotRowDto] })
  slots: SlotRowDto[];
}

export class LiveMessageCatalogDto {
  @ApiProperty({ enum: LiveMessageName, enumName: 'LiveMessageName' })
  name: LiveMessageName;
}

export function roomChannel(slug: string): string {
  return `room:${slug}`;
}
