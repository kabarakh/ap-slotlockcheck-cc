import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { Room, Slot } from '../generated/prisma/client.js';
import { LocationStatusService } from '../locations/location-status.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { ArchipelagoService } from '../sources/archipelago/archipelago.service.js';
import { SyncService } from '../sync/sync.service.js';
import { adminCommands } from './admin-commands.js';
import type { AdminConnectionTarget } from './admin-connection.js';
import { AdminJobsService, ServerLoginError, type AdminJob } from './admin-jobs.service.js';
import { AdminSessionService, type AdminSession } from './admin-session.service.js';
import type {
  ItemNamesDto,
  ReleasePreviewDto,
  ReleaseSpheresDto,
  SendItemDto,
  ServerAdminStatusDto,
  ServerJobDto,
  ServerLoginDto,
} from './dto/archipelago-admin.dto.js';
import { releaseWhere, slotCommandName, websocketAddress } from './server-target.logic.js';

@Injectable()
export class ArchipelagoAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomsService,
    private readonly archipelago: ArchipelagoService,
    private readonly sessions: AdminSessionService,
    private readonly jobs: AdminJobsService,
    private readonly sync: SyncService,
    private readonly locationStatus: LocationStatusService,
  ) {}

  async status(slug: string): Promise<ServerAdminStatusDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const session = this.sessions.get(room.id);
    const job = this.jobs.latest(room.id);
    return { loggedIn: session !== undefined, slotId: session?.slotId ?? null, job: job ? toJobDto(job) : null };
  }

  async login(slug: string, request: ServerLoginDto): Promise<ServerAdminStatusDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const slot = await this.connectionSlot(room, request.slotId);
    const session: AdminSession = {
      slotId: slot.id,
      serverPassword: request.serverPassword,
      roomPassword: request.roomPassword || undefined,
    };
    try {
      await this.jobs.testLogin(() => this.target(room, slot, session), session.serverPassword);
    } catch (error) {
      if (error instanceof ServerLoginError) {
        throw new BadRequestException(error.code);
      }
      throw error;
    }
    this.sessions.set(room.id, session);
    return this.status(slug);
  }

  async logout(slug: string): Promise<ServerAdminStatusDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    this.sessions.delete(room.id);
    return this.status(slug);
  }

  async sendLocations(slug: string, locationIds: number[]): Promise<ServerJobDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const locations = await this.prisma.seedLocation.findMany({
      where: { roomId: room.id, id: { in: locationIds } },
      include: { finderSlot: true },
      orderBy: [{ sphere: 'asc' }, { id: 'asc' }],
    });
    if (locations.length !== new Set(locationIds).size) {
      throw new NotFoundException('LOCATION_NOT_FOUND');
    }
    const lines = locations.map((location) =>
      adminCommands.sendLocation(slotCommandName(location.finderSlot), location.locationName),
    );
    return this.run(room, 'send_location', lines);
  }

  async sendItem(slug: string, request: SendItemDto): Promise<ServerJobDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const slot = await this.slotOf(room, request.slotId);
    return this.run(room, 'send_item', [
      adminCommands.sendItem(slotCommandName(slot), request.itemName, request.amount),
    ]);
  }

  async release(slug: string, slotId: number): Promise<ServerJobDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const slot = await this.slotOf(room, slotId);
    return this.run(room, 'release', [adminCommands.release(slotCommandName(slot))]);
  }

  async collect(slug: string, slotId: number): Promise<ServerJobDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const slot = await this.slotOf(room, slotId);
    return this.run(room, 'collect', [adminCommands.collect(slotCommandName(slot))]);
  }

  async previewRelease(slug: string, request: ReleaseSpheresDto): Promise<ReleasePreviewDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const where = releaseWhere(room.id, request.fromSphere, request.toSphere, request.mode);
    const [locationCount, progressionCount] = await Promise.all([
      this.prisma.seedLocation.count({ where }),
      this.prisma.seedLocation.count({ where: { AND: [where, { itemType: 'progression' }] } }),
    ]);
    return { locationCount, progressionCount };
  }

  async releaseSpheres(slug: string, request: ReleaseSpheresDto): Promise<ServerJobDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const locations = await this.prisma.seedLocation.findMany({
      where: releaseWhere(room.id, request.fromSphere, request.toSphere, request.mode),
      include: { finderSlot: true },
      orderBy: [{ sphere: 'asc' }, { id: 'asc' }],
    });
    if (locations.length === 0) {
      throw new BadRequestException('NO_LOCATIONS_TO_RELEASE');
    }
    const lines = locations.map((location) =>
      adminCommands.sendLocation(slotCommandName(location.finderSlot), location.locationName),
    );
    return this.run(room, 'release_spheres', lines);
  }

  async itemNames(slug: string, slotId: number): Promise<ItemNamesDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const slot = await this.slotOf(room, slotId);
    const datapackage = await this.prisma.datapackage.findFirst({
      where: { game: slot.game },
      orderBy: { createdAt: 'desc' },
    });
    if (datapackage) {
      return { itemNames: Object.keys(JSON.parse(datapackage.itemNames) as Record<string, number>).sort() };
    }
    const received = await this.prisma.seedLocation.findMany({
      where: { roomId: room.id, receiverSlotId: slot.id },
      distinct: ['itemName'],
      select: { itemName: true },
    });
    return { itemNames: received.map((location) => location.itemName).sort() };
  }

  async job(slug: string): Promise<ServerJobDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    const job = this.jobs.latest(room.id);
    if (!job) {
      throw new NotFoundException('SERVER_JOB_NOT_FOUND');
    }
    return toJobDto(job);
  }

  async stopJob(slug: string, jobId: string): Promise<ServerJobDto> {
    const room = await this.rooms.findRoomBySlug(slug);
    if (!this.jobs.stop(room.id, jobId)) {
      throw new ConflictException('SERVER_JOB_NOT_RUNNING');
    }
    return this.job(slug);
  }

  private async run(room: Room, command: string, lines: string[]): Promise<ServerJobDto> {
    const session = this.sessions.get(room.id);
    if (!session) {
      throw new HttpException('SERVER_LOGIN_REQUIRED', HttpStatus.PRECONDITION_REQUIRED);
    }
    if (this.jobs.isRunning(room.id)) {
      throw new ConflictException('SERVER_COMMAND_RUNNING');
    }
    const slot = await this.slotOf(room, session.slotId);
    const job = this.jobs.start({
      roomId: room.id,
      command,
      serverPassword: session.serverPassword,
      resolveTarget: () => this.target(room, slot, session),
      lines,
      onFinished: async () => {
        await this.sync.syncRoom(room.id, 'manual');
        await this.locationStatus.publishChanged(room.slug, room.id, lines.length);
      },
    });
    return toJobDto(job);
  }

  private async target(room: Room, slot: Slot, session: AdminSession): Promise<AdminConnectionTarget> {
    if (!room.archipelagoRoomId) {
      throw new BadRequestException('ROOM_LINK_MISSING');
    }
    await this.archipelago.wakeRoom(room.archipelagoOrigin, room.archipelagoRoomId);
    const status = await this.archipelago.getRoomStatus(room.archipelagoOrigin, room.archipelagoRoomId);
    return {
      address: websocketAddress(room.archipelagoOrigin, status.last_port),
      slotName: slotCommandName(slot),
      roomPassword: session.roomPassword,
    };
  }

  private async connectionSlot(room: Room, slotId: number | undefined): Promise<Slot> {
    const lockers = await this.prisma.slot.findMany({
      where: { roomId: room.id, isSelectedSlotLock: true },
      orderBy: { position: 'asc' },
    });
    const candidates =
      lockers.length > 0
        ? lockers
        : await this.prisma.slot.findMany({
            where: { roomId: room.id, isSlotLock: false },
            orderBy: { position: 'asc' },
          });
    const slot =
      slotId === undefined && candidates.length === 1
        ? candidates[0]
        : candidates.find((candidate) => candidate.id === slotId);
    if (!slot) {
      throw new BadRequestException('CONNECTION_SLOT_REQUIRED');
    }
    return slot;
  }

  private async slotOf(room: Room, slotId: number): Promise<Slot> {
    const slot = await this.prisma.slot.findFirst({ where: { id: slotId, roomId: room.id } });
    if (!slot) {
      throw new BadRequestException('SLOT_NOT_IN_ROOM');
    }
    return slot;
  }
}

function toJobDto(job: AdminJob): ServerJobDto {
  return {
    id: job.id,
    command: job.command,
    total: job.total,
    done: job.done,
    errors: [...job.errors],
    state: job.state,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}
