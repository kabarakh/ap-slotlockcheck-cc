import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import type { AuthUser } from '../auth/auth.types.js';
import { RoomRoleService } from '../auth/room-role.service.js';
import type { Room } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RoomMembershipDto } from '../rooms/dto/room.dto.js';
import { RoomsService } from '../rooms/rooms.service.js';
import type { ItemType } from '../seed/item-type.js';
import type {
  LocationAdminPageDto,
  LocationAdminRowDto,
  LocationQueryDto,
  LocationSortField,
  LocationUserPageDto,
  LocationUserRowDto,
  SphereCleanupDto,
  SphereCleanupQueryDto,
  SphereOverviewDto,
} from './dto/location.dto.js';
import { cleanupEntries } from './cleanup.logic.js';
import { canMarkFiller, canRemoveFillerMark } from './filler-permission.logic.js';
import { isGoaled } from './goal.logic.js';
import { LocationStatusService } from './location-status.service.js';
import { locationOrderBy, locationWhere } from './location-query.js';
import { summarizeSpheres, visibleMaxSphere } from './sphere.logic.js';

const DEFAULT_PAGE_SIZE = 50;

interface RoomAccess {
  room: Room;
  membership: RoomMembershipDto;
  sphereCount: number;
  lowestOpenSphere: number | null;
  visibleMaxSphere: number;
}

interface PageOverrides {
  toSphere: number | null;
  itemTypes: ItemType[];
  receiverSlotIds: number[];
  sort: LocationSortField;
}

type Fields<Dto> = { [Key in keyof Dto]: Dto[Key] };

type LocationWithRelations = Awaited<ReturnType<LocationsService['findPage']>>['rows'][number];

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly roles: RoomRoleService,
    private readonly status: LocationStatusService,
  ) {}

  async getSpheres(slug: string, user: AuthUser | undefined, excludeGoaled: boolean): Promise<SphereOverviewDto> {
    const access = await this.access(slug, user);
    const isHelper = RoomRoleService.satisfies(access.membership.role, 'helper');
    const slots = await this.prisma.slot.findMany({ where: { roomId: access.room.id } });
    const goaled = new Map(slots.map((slot) => [slot.id, isGoaled(slot)]));
    const groups = await this.prisma.seedLocation.groupBy({
      by: ['sphere', 'checked', 'itemType', 'finderSlotId', 'receiverSlotId'],
      where: { roomId: access.room.id },
      _count: { _all: true },
    });
    const summaries = summarizeSpheres(
      groups.map((group) => ({
        sphere: group.sphere,
        checked: group.checked,
        itemType: group.itemType as ItemType,
        finderGoaled: goaled.get(group.finderSlotId) ?? false,
        receiverGoaled: group.receiverSlotId === null ? false : (goaled.get(group.receiverSlotId) ?? false),
        count: group._count._all,
      })),
      excludeGoaled,
    ).filter((summary) => isHelper || summary.sphere <= access.visibleMaxSphere);
    return {
      lowestOpenSphere: access.lowestOpenSphere,
      visibleMaxSphere: isHelper ? access.sphereCount : access.visibleMaxSphere,
      sphereCount: access.sphereCount,
      spheres: summaries.map(({ sphere, open, found, total }) => ({ sphere, open, found, total })),
      itemTypes: isHelper ? summaries.map((summary) => ({ sphere: summary.sphere, ...summary.openByType })) : null,
    };
  }

  async getUserPage(slug: string, user: AuthUser | undefined, query: LocationQueryDto): Promise<LocationUserPageDto> {
    const access = await this.access(slug, user);
    const isHelper = RoomRoleService.satisfies(access.membership.role, 'helper');
    const limitSpheres = query.state === 'open' && !isHelper;
    const toSphere = limitSpheres
      ? Math.min(query.toSphere ?? access.visibleMaxSphere, access.visibleMaxSphere)
      : (query.toSphere ?? null);
    const sort = query.sort === 'receiver' || query.sort === 'item' ? 'sphere' : query.sort;
    const page = await this.findPage(access, user, query, {
      toSphere,
      itemTypes: [],
      receiverSlotIds: [],
      sort: sort ?? 'sphere',
    });
    return { total: page.total, rows: page.rows.map((row) => this.toUserRow(access, user, row)) };
  }

  async getAdminPage(slug: string, user: AuthUser | undefined, query: LocationQueryDto): Promise<LocationAdminPageDto> {
    const access = await this.access(slug, user);
    if (!RoomRoleService.satisfies(access.membership.role, 'helper')) {
      throw new ForbiddenException('Role helper required');
    }
    const page = await this.findPage(access, user, query, {
      toSphere: query.toSphere ?? null,
      itemTypes: query.itemTypes ?? [],
      receiverSlotIds: query.receiverSlotIds ?? [],
      sort: query.sort ?? 'sphere',
    });
    return { total: page.total, rows: page.rows.map((row) => this.toAdminRow(access, user, row)) };
  }

  async getCleanup(slug: string, query: SphereCleanupQueryDto): Promise<SphereCleanupDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const fromSphere = Math.min(query.fromSphere, query.toSphere);
    const toSphere = Math.max(query.fromSphere, query.toSphere);
    const slots = await this.prisma.slot.findMany({ where: { roomId: room.id } });
    const goaled = new Map(slots.map((slot) => [slot.id, isGoaled(slot)]));
    const groups = await this.prisma.seedLocation.groupBy({
      by: ['sphere', 'finderSlotId', 'itemType', 'receiverSlotId'],
      where: { roomId: room.id, checked: false, sphere: { gte: fromSphere, lte: toSphere } },
      _count: { _all: true },
    });
    const entries = cleanupEntries(
      groups.map((group) => ({
        sphere: group.sphere,
        finderSlotId: group.finderSlotId,
        itemType: group.itemType as ItemType,
        finderGoaled: goaled.get(group.finderSlotId) ?? false,
        receiverGoaled: group.receiverSlotId === null ? false : (goaled.get(group.receiverSlotId) ?? false),
        count: group._count._all,
      })),
      slots,
      query.slots ?? 'all',
      query.excludeGoaled ?? false,
    );
    return { fromSphere, toSphere, entries };
  }

  async setFillerMark(slug: string, user: AuthUser | undefined, locationId: number, marked: boolean): Promise<void> {
    const room = await this.rooms.findRoomBySlug(slug);
    const membership = await this.roles.getMembership(user, room);
    const location = await this.prisma.seedLocation.findFirst({
      where: { id: locationId, roomId: room.id },
      include: { finderSlot: true },
    });
    if (!location) {
      throw new NotFoundException('LOCATION_NOT_FOUND');
    }
    if (marked && location.checked) {
      throw new BadRequestException('LOCATION_ALREADY_CHECKED');
    }
    const permitted = marked
      ? canMarkFiller({
          role: membership.role,
          playersMarkFiller: room.playersMarkFiller,
          isOwnSlot: user !== undefined && location.finderSlot.discordUserId === user.discordId,
          checked: location.checked,
        })
      : canRemoveFillerMark(membership.role);
    if (!permitted) {
      throw new ForbiddenException('FILLER_MARK_NOT_PERMITTED');
    }
    await this.prisma.seedLocation.update({
      where: { id: location.id },
      data: marked
        ? { fillerMarkedAt: new Date(), fillerMarkedByUserId: user?.id ?? null }
        : { fillerMarkedAt: null, fillerMarkedByUserId: null },
    });
    await this.status.publishChanged(slug, room.id, 1);
  }

  private async access(slug: string, user: AuthUser | undefined): Promise<RoomAccess> {
    const room = await this.rooms.findRoomBySlug(slug);
    const membership = await this.roles.getMembership(user, room);
    if (membership.role === 'visitor' && !room.visitorsSeeLocations) {
      throw new ForbiddenException('LOCATIONS_NOT_PUBLIC');
    }
    const seed = await this.prisma.seedData.findUnique({ where: { roomId: room.id } });
    const sphereCount = seed?.sphereCount ?? 0;
    const lowestOpenSphere = await this.status.lowestOpenSphere(room.id);
    return {
      room,
      membership,
      sphereCount,
      lowestOpenSphere,
      visibleMaxSphere: visibleMaxSphere(lowestOpenSphere, room.sphereOffset, sphereCount),
    };
  }

  private async findPage(
    access: RoomAccess,
    user: AuthUser | undefined,
    query: LocationQueryDto,
    overrides: PageOverrides,
  ) {
    if (query.slots === 'mine' && !user) {
      throw new ForbiddenException('LOGIN_REQUIRED');
    }
    const where = locationWhere({
      roomId: access.room.id,
      state: query.state,
      slots: query.slots ?? 'all',
      slotIds: query.slotIds ?? [],
      receiverSlotIds: overrides.receiverSlotIds,
      discordUserId: user?.discordId ?? null,
      itemTypes: overrides.itemTypes,
      fromSphere: query.fromSphere ?? null,
      toSphere: overrides.toSphere,
      excludeGoaled: query.excludeGoaled ?? false,
    });
    const [total, rows] = await Promise.all([
      this.prisma.seedLocation.count({ where }),
      this.prisma.seedLocation.findMany({
        where,
        include: { finderSlot: true, fillerMarkedBy: true },
        orderBy: locationOrderBy(overrides.sort, query.order ?? 'asc'),
        skip: query.offset ?? 0,
        take: query.limit ?? DEFAULT_PAGE_SIZE,
      }),
    ]);
    return { total, rows };
  }

  private toUserRow(
    access: RoomAccess,
    user: AuthUser | undefined,
    row: LocationWithRelations,
  ): Fields<LocationUserRowDto> {
    return {
      id: row.id,
      sphere: row.sphere,
      finderSlotId: row.finderSlotId,
      finderName: row.finderSlot.name,
      discordName: row.finderSlot.discordName,
      game: row.finderSlot.game,
      locationName: row.locationName,
      fillerMarked: row.fillerMarkedAt !== null,
      canMarkFiller: canMarkFiller({
        role: access.membership.role,
        playersMarkFiller: access.room.playersMarkFiller,
        isOwnSlot: user !== undefined && row.finderSlot.discordUserId === user.discordId,
        checked: row.checked,
      }),
    };
  }

  private toAdminRow(access: RoomAccess, user: AuthUser | undefined, row: LocationWithRelations): LocationAdminRowDto {
    return {
      ...this.toUserRow(access, user, row),
      receiverName: row.receiverName,
      itemName: row.itemName,
      itemType: row.itemType as ItemType,
      fillerMarkedByName: row.fillerMarkedBy?.name ?? null,
      fillerMarkedAt: row.fillerMarkedAt?.toISOString() ?? null,
    };
  }
}
