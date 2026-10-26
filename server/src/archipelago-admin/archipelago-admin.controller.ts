import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { RequireRoomRole } from '../auth/auth.decorators.js';
import { ArchipelagoAdminService } from './archipelago-admin.service.js';
import {
  ItemNamesDto,
  ItemNamesQueryDto,
  ReleasePreviewDto,
  ReleaseSpheresDto,
  ReleaseSpheresQueryDto,
  SendItemDto,
  SendLocationsDto,
  ServerAdminStatusDto,
  ServerJobDto,
  ServerLoginDto,
  SlotCommandDto,
} from './dto/archipelago-admin.dto.js';

@Controller('rooms/:slug/server-admin')
@RequireRoomRole('admin')
export class ArchipelagoAdminController {
  constructor(private readonly serverAdmin: ArchipelagoAdminService) {}

  @Get()
  status(@Param('slug') slug: string): Promise<ServerAdminStatusDto> {
    return this.serverAdmin.status(slug);
  }

  @Put('login')
  login(@Param('slug') slug: string, @Body() body: ServerLoginDto): Promise<ServerAdminStatusDto> {
    return this.serverAdmin.login(slug, body);
  }

  @Delete('login')
  logout(@Param('slug') slug: string): Promise<ServerAdminStatusDto> {
    return this.serverAdmin.logout(slug);
  }

  @Post('send-location')
  @HttpCode(202)
  sendLocations(@Param('slug') slug: string, @Body() body: SendLocationsDto): Promise<ServerJobDto> {
    return this.serverAdmin.sendLocations(slug, body.locationIds);
  }

  @Post('send-item')
  @HttpCode(202)
  sendItem(@Param('slug') slug: string, @Body() body: SendItemDto): Promise<ServerJobDto> {
    return this.serverAdmin.sendItem(slug, body);
  }

  @Post('release')
  @HttpCode(202)
  release(@Param('slug') slug: string, @Body() body: SlotCommandDto): Promise<ServerJobDto> {
    return this.serverAdmin.release(slug, body.slotId);
  }

  @Post('collect')
  @HttpCode(202)
  collect(@Param('slug') slug: string, @Body() body: SlotCommandDto): Promise<ServerJobDto> {
    return this.serverAdmin.collect(slug, body.slotId);
  }

  @Get('release-spheres/preview')
  previewRelease(@Param('slug') slug: string, @Query() query: ReleaseSpheresQueryDto): Promise<ReleasePreviewDto> {
    return this.serverAdmin.previewRelease(slug, query);
  }

  @Post('release-spheres')
  @HttpCode(202)
  releaseSpheres(@Param('slug') slug: string, @Body() body: ReleaseSpheresDto): Promise<ServerJobDto> {
    return this.serverAdmin.releaseSpheres(slug, body);
  }

  @Get('items')
  itemNames(@Param('slug') slug: string, @Query() query: ItemNamesQueryDto): Promise<ItemNamesDto> {
    return this.serverAdmin.itemNames(slug, query.slotId);
  }

  @Get('job')
  job(@Param('slug') slug: string): Promise<ServerJobDto> {
    return this.serverAdmin.job(slug);
  }

  @Delete('jobs/:id')
  stopJob(@Param('slug') slug: string, @Param('id') id: string): Promise<ServerJobDto> {
    return this.serverAdmin.stopJob(slug, id);
  }
}
