import { Controller, Get, Param, Query } from '@nestjs/common';
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

  @Get('locations/admin')
  getAdminPage(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthUser | undefined,
    @Query() query: LocationQueryDto,
  ): Promise<LocationAdminPageDto> {
    return this.locations.getAdminPage(slug, user, query);
  }
}
