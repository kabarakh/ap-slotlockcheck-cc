import { tmpdir } from 'node:os';
import { Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

import { CurrentUser, RequireRoomRole } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { SeedDataDto, SeedUploadDto } from './dto/seed.dto.js';
import { SeedService } from './seed.service.js';

export const MAXIMUM_SEED_UPLOAD_BYTES = 500 * 1024 * 1024;

@Controller('rooms/:slug/seed')
export class SeedController {
  constructor(private readonly seed: SeedService) {}

  @Get()
  @RequireRoomRole('helper')
  get(@Param('slug') slug: string): Promise<SeedDataDto> {
    return this.seed.get(slug);
  }

  @Post()
  @RequireRoomRole('admin')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: SeedUploadDto })
  @UseInterceptors(
    FileInterceptor('file', { dest: tmpdir(), limits: { fileSize: MAXIMUM_SEED_UPLOAD_BYTES, files: 1 } }),
  )
  upload(
    @Param('slug') slug: string,
    @CurrentUser() admin: AuthUser,
    @UploadedFile() file: { path: string } | undefined,
  ): Promise<SeedDataDto> {
    return this.seed.upload(slug, admin, file?.path);
  }
}
