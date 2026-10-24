import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUser, RequireRoomRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CreateWarningDto, WarningDto } from './dto/warning.dto.js';
import { WarningsService } from './warnings.service.js';

@Controller('rooms/:slug/warnings')
@RequireRoomRole('admin')
export class WarningsController {
  constructor(private readonly warnings: WarningsService) {}

  @Get()
  list(@Param('slug') slug: string): Promise<WarningDto[]> {
    return this.warnings.list(slug);
  }

  @Post()
  create(
    @Param('slug') slug: string,
    @CurrentUser() admin: AuthUser,
    @Body() body: CreateWarningDto,
  ): Promise<WarningDto[]> {
    return this.warnings.create(slug, admin, body);
  }

  @Delete(':id')
  delete(@Param('slug') slug: string, @Param('id', ParseIntPipe) id: number): Promise<WarningDto[]> {
    return this.warnings.delete(slug, id);
  }
}
