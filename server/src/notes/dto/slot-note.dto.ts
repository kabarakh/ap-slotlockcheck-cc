import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

import { SLOT_NOTE_MAX_LENGTH } from '../notes.logic.js';

export class StaffNoteDto {
  text: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;

  updatedByName: string;
}

export class InternalNoteDto extends StaffNoteDto {
  slotId: number;
}

export class UpdateSlotNoteDto {
  @IsString()
  @MaxLength(SLOT_NOTE_MAX_LENGTH)
  text: string;
}
