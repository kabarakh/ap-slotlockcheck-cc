import type { Socket } from 'socket.io';

import { LiveMessageName } from './dto/live-messages.dto.js';
import { LiveGateway } from './live.gateway.js';

function fakeSocket(channels: string[]): Socket {
  const rooms = new Set(channels);
  return {
    rooms,
    join: vi.fn((channel: string) => rooms.add(channel)),
    leave: vi.fn((channel: string) => rooms.delete(channel)),
  } as unknown as Socket;
}

describe('LiveGateway', () => {
  it('moves a client from its old room channel to the new one', async () => {
    const gateway = new LiveGateway();
    const socket = fakeSocket(['socket-id', 'room:old']);
    await expect(gateway.joinRoom(socket, 'big-chill')).resolves.toBe(true);
    expect([...socket.rooms]).toEqual(['socket-id', 'room:big-chill']);
  });

  it('rejects an invalid slug', async () => {
    const gateway = new LiveGateway();
    await expect(gateway.joinRoom(fakeSocket([]), '../x')).resolves.toBe(false);
    await expect(gateway.joinRoom(fakeSocket([]), 42)).resolves.toBe(false);
  });

  it('sends messages to the channel of the room', () => {
    const gateway = new LiveGateway();
    const emit = vi.fn();
    const to = vi.fn().mockReturnValue({ emit });
    gateway.server = { to } as never;
    gateway.publishSyncFailed({
      slug: 'big-chill',
      syncStatus: { lastSyncAt: null, lastSuccessfulSyncAt: null, lastSyncError: 'x', running: false },
    });
    expect(to).toHaveBeenCalledWith('room:big-chill');
    expect(emit).toHaveBeenCalledWith(LiveMessageName.RoomSyncFailed, expect.objectContaining({ slug: 'big-chill' }));
  });

  it('sends the change of the locations without items', () => {
    const gateway = new LiveGateway();
    const emit = vi.fn();
    gateway.server = { to: vi.fn().mockReturnValue({ emit }) } as never;
    gateway.publishLocationsChanged({ slug: 'big-chill', lowestOpenSphere: 2, changedCount: 3 });
    expect(emit).toHaveBeenCalledWith(LiveMessageName.LocationsChanged, {
      slug: 'big-chill',
      lowestOpenSphere: 2,
      changedCount: 3,
    });
  });
});
