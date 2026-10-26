import { Injectable } from '@nestjs/common';

import { LiveGateway } from '../live/live.gateway.js';
import { RoomsService } from './rooms.service.js';

@Injectable()
export class RoomUpdatesService {
  constructor(
    private readonly rooms: RoomsService,
    private readonly live: LiveGateway,
  ) {}

  async publish(slug: string): Promise<void> {
    const room = await this.rooms.findRoomBySlug(slug);
    const slots = await this.rooms.getRosterForRoom(room.id);
    const hasSeed = await this.rooms.hasSeed(room.id);
    this.live.publishUpdated({ slug, room: this.rooms.toDetail(room, slots, hasSeed), slots });
  }
}
