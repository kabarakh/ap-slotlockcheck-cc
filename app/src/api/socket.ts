import { io, type Socket } from 'socket.io-client';
import type {
  LiveMessageName,
  LocationsChangedPayload,
  RoomSyncedPayload,
  RoomSyncFailedPayload,
  RoomUpdatedPayload,
} from './types';

export const LIVE_MESSAGES = {
  roomJoin: 'room:join',
  roomLeave: 'room:leave',
  roomSynced: 'room:synced',
  roomSyncFailed: 'room:sync-failed',
  roomUpdated: 'room:updated',
  locationsChanged: 'room:locations-changed',
} as const satisfies Record<string, LiveMessageName>;

export interface ServerToClientMessages {
  [LIVE_MESSAGES.roomSynced]: (payload: RoomSyncedPayload) => void;
  [LIVE_MESSAGES.roomSyncFailed]: (payload: RoomSyncFailedPayload) => void;
  [LIVE_MESSAGES.roomUpdated]: (payload: RoomUpdatedPayload) => void;
  [LIVE_MESSAGES.locationsChanged]: (payload: LocationsChangedPayload) => void;
}

export interface ClientToServerMessages {
  [LIVE_MESSAGES.roomJoin]: (slug: string, acknowledge: (joined: boolean) => void) => void;
  [LIVE_MESSAGES.roomLeave]: (slug: string) => void;
}

export type LiveSocket = Socket<ServerToClientMessages, ClientToServerMessages>;

export function createLiveSocket(): LiveSocket {
  return io({ path: '/socket.io', transports: ['websocket', 'polling'], autoConnect: false });
}
