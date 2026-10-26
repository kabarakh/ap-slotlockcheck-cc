import { Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import {
  LocationAdminPageDto,
  LocationQueryDto,
  LocationUserPageDto,
  SphereOverviewDto,
  SphereQueryDto,
} from './dto/location.dto.js';
import { LocationsService } from './locations.service.js';

@Controller('rooms/:slug')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get('spheres')
  getSpheres(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query() query: SphereQueryDto,
  ): Promise<SphereOverviewDto> {
    return this.locations.getSpheres(slug, user, query.excludeGoaled ?? false);
  }

  @Get('locations')
  getUserPage(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query() query: LocationQueryDto,
  ): Promise<LocationUserPageDto> {
    return this.locations.getUserPage(slug, user, query);
  }

  @Put('locations/:id/filler-mark')
  @HttpCode(204)
  markFiller(
    @Param('slug') slug: string,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<void> {
    return this.locations.setFillerMark(slug, user, id, true);
  }

  @Delete('locations/:id/filler-mark')
  @HttpCode(204)
  unmarkFiller(
    @Param('slug') slug: string,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<void> {
    return this.locations.setFillerMark(slug, user, id, false);
  }

  @Get('locations/admin')
  getAdminPage(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query() query: LocationQueryDto,
  ): Promise<LocationAdminPageDto> {
    return this.locations.getAdminPage(slug, user, query);
  }
}
