import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';

import { RequireRoomRole } from '../auth/auth.decorators.js';
import { AdminsService } from './admins.service.js';
import {
  AddRoomAdminDto,
  LockAssignmentDto,
  ResetLockAssignmentDto,
  RoomAdminDto,
  SetLockAssignmentDto,
  UpdateRoomSettingsDto,
} from './dto/admins.dto.js';

@Controller('rooms/:slug/admins')
@RequireRoomRole('admin')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  list(@Param('slug') slug: string): Promise<RoomAdminDto[]> {
    return this.admins.listAdmins(slug);
  }

  @Post()
  add(@Param('slug') slug: string, @Body() body: AddRoomAdminDto): Promise<RoomAdminDto[]> {
    return this.admins.addAdmin(slug, body.discordId, body.role);
  }

  @Delete(':userId')
  remove(@Param('slug') slug: string, @Param('userId', ParseIntPipe) userId: number): Promise<RoomAdminDto[]> {
    return this.admins.removeAdmin(slug, userId);
  }
}

@Controller('rooms/:slug/settings')
@RequireRoomRole('admin')
export class RoomSettingsController {
  constructor(private readonly admins: AdminsService) {}

  @Patch()
  @HttpCode(204)
  update(@Param('slug') slug: string, @Body() body: UpdateRoomSettingsDto): Promise<void> {
    return this.admins.updateSettings(slug, body);
  }
}

@Controller('rooms/:slug/lock-assignments')
@RequireRoomRole('admin')
export class LockAssignmentsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  list(@Param('slug') slug: string): Promise<LockAssignmentDto[]> {
    return this.admins.listLockAssignments(slug);
  }

  @Put()
  set(@Param('slug') slug: string, @Body() body: SetLockAssignmentDto): Promise<LockAssignmentDto[]> {
    return this.admins.setLockAssignment(slug, body);
  }

  @Post('reset')
  @HttpCode(200)
  reset(@Param('slug') slug: string, @Body() body: ResetLockAssignmentDto): Promise<LockAssignmentDto[]> {
    return this.admins.resetLockAssignment(slug, body);
  }
}
