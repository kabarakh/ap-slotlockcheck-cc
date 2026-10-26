import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import {
  LiveMessageName,
  roomChannel,
  type LocationsChangedPayloadDto,
  type RoomSyncedPayloadDto,
  type RoomSyncFailedPayloadDto,
  type RoomUpdatedPayloadDto,
} from './dto/live-messages.dto.js';

const SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;

@WebSocketGateway()
export class LiveGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage(LiveMessageName.RoomJoin)
  async joinRoom(@ConnectedSocket() client: Socket, @MessageBody() slug: unknown): Promise<boolean> {
    if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
      return false;
    }
    for (const channel of [...client.rooms].filter((candidate) => candidate.startsWith('room:'))) {
      await client.leave(channel);
    }
    await client.join(roomChannel(slug));
    return true;
  }

  @SubscribeMessage(LiveMessageName.RoomLeave)
  async leaveRoom(@ConnectedSocket() client: Socket, @MessageBody() slug: unknown): Promise<boolean> {
    if (typeof slug !== 'string') {
      return false;
    }
    await client.leave(roomChannel(slug));
    return true;
  }

  publishSynced(payload: RoomSyncedPayloadDto): void {
    this.server?.to(roomChannel(payload.slug)).emit(LiveMessageName.RoomSynced, payload);
  }

  publishSyncFailed(payload: RoomSyncFailedPayloadDto): void {
    this.server?.to(roomChannel(payload.slug)).emit(LiveMessageName.RoomSyncFailed, payload);
  }

  publishUpdated(payload: RoomUpdatedPayloadDto): void {
    this.server?.to(roomChannel(payload.slug)).emit(LiveMessageName.RoomUpdated, payload);
  }

  publishLocationsChanged(payload: LocationsChangedPayloadDto): void {
    this.server?.to(roomChannel(payload.slug)).emit(LiveMessageName.LocationsChanged, payload);
  }
}
