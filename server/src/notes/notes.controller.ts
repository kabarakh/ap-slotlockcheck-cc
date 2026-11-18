import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';

import { CurrentUser, RequireRoomRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { InternalNoteDto, StaffNoteDto, UpdateSlotNoteDto } from './dto/slot-note.dto.js';
import { SLOT_NOTE_KINDS } from './notes.logic.js';
import { NotesService } from './notes.service.js';

@Controller('rooms/:slug')
@RequireRoomRole('helper')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get('notes/internal')
  listInternal(@Param('slug') slug: string): Promise<InternalNoteDto[]> {
    return this.notes.listInternal(slug);
  }

  @Put('slots/:slotId/notes/:kind')
  @ApiParam({ name: 'kind', enum: SLOT_NOTE_KINDS, enumName: 'SlotNoteKind' })
  update(
    @Param('slug') slug: string,
    @Param('slotId', ParseIntPipe) slotId: number,
    @Param('kind') kind: string,
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateSlotNoteDto,
  ): Promise<StaffNoteDto> {
    return this.notes.update(slug, slotId, kind, body.text, user);
  }
}
