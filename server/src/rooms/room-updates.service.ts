import { Injectable } from '@nestjs/common';

import type { Room } from '../generated/prisma/client.js';
import { LiveGateway } from '../live/live.gateway.js';
import { RoomsService } from './rooms.service.js';

export type RoomUpdateListener = (room: Room) => void;

@Injectable()
export class RoomUpdatesService {
  private readonly listeners: RoomUpdateListener[] = [];

  constructor(
    private readonly rooms: RoomsService,
    private readonly live: LiveGateway,
  ) {}

  onPublish(listener: RoomUpdateListener): void {
    this.listeners.push(listener);
  }

  async publish(slug: string): Promise<void> {
    const room = await this.rooms.findRoomBySlug(slug);
    for (const listener of this.listeners) {
      listener(room);
    }
    const slots = await this.rooms.getRosterForRoom(room.id);
    const hasSeed = await this.rooms.hasSeed(room.id);
    this.live.publishUpdated({ slug, room: this.rooms.toDetail(room, slots, hasSeed), slots });
  }
}
