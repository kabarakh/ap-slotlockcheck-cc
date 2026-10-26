import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';

type Packet = Record<string, unknown> & { cmd: string };

export interface FakeArchipelagoServer {
  port: number;
  said: string[];
  connects: Packet[];
  close(): Promise<void>;
}

const ADMIN_PASSWORD = 'admin-secret';

function send(socket: WebSocket, packets: Packet[]): void {
  socket.send(JSON.stringify(packets));
}

function printJson(type: string, text: string): Packet {
  return { cmd: 'PrintJSON', type, data: [{ text }] };
}

function roomInfo(): Packet {
  return {
    cmd: 'RoomInfo',
    version: { major: 0, minor: 6, build: 8, class: 'Version' },
    generator_version: { major: 0, minor: 6, build: 8, class: 'Version' },
    tags: ['AP'],
    password: true,
    permissions: { release: 2, collect: 0, remaining: 0 },
    hint_cost: 10,
    location_check_points: 1,
    games: ['SlotLock'],
    datapackage_checksums: {},
    seed_name: '12345678901234567890',
    time: Date.now() / 1000,
  };
}

function connected(name: string): Packet {
  return {
    cmd: 'Connected',
    team: 0,
    slot: 1,
    players: [{ team: 0, slot: 1, alias: name, name, class: 'NetworkPlayer' }],
    missing_locations: [],
    checked_locations: [],
    slot_data: {},
    slot_info: { '1': { name, game: 'SlotLock', type: 1, group_members: [], class: 'NetworkSlot' } },
    hint_points: 0,
  };
}

function answer(socket: WebSocket, packet: Packet, state: FakeArchipelagoServer, roomPassword: string): void {
  if (packet.cmd === 'Connect') {
    state.connects.push(packet);
    if (packet['password'] !== roomPassword) {
      send(socket, [{ cmd: 'ConnectionRefused', errors: ['InvalidPassword'] }]);
      return;
    }
    send(socket, [connected(String(packet['name']))]);
  } else if (packet.cmd === 'GetDataPackage') {
    send(socket, [{ cmd: 'DataPackage', data: { games: {} } }]);
  } else if (packet.cmd === 'Say') {
    const text = String(packet['text']);
    state.said.push(text);
    if (text.startsWith('!admin login ')) {
      const correct = text === `!admin login ${ADMIN_PASSWORD}`;
      send(socket, [
        printJson(
          'CommandResult',
          correct ? 'Login successful. You can now issue server side commands.' : 'Password incorrect.',
        ),
      ]);
    } else if (text.includes('Nowhere')) {
      send(socket, [printJson('AdminCommandResult', 'Could not find location Nowhere')]);
    } else {
      send(socket, [printJson('Chat', text)]);
    }
  }
}

export function startFakeArchipelagoServer(roomPassword: string): Promise<FakeArchipelagoServer> {
  const server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  const state: FakeArchipelagoServer = {
    port: 0,
    said: [],
    connects: [],
    close: () =>
      new Promise((resolve) => {
        server.clients.forEach((client) => client.terminate());
        server.close(() => resolve());
      }),
  };
  server.on('connection', (socket) => {
    send(socket, [roomInfo()]);
    socket.on('message', (data: Buffer) => {
      for (const packet of JSON.parse(data.toString()) as Packet[]) {
        answer(socket, packet, state, roomPassword);
      }
    });
  });
  return new Promise((resolve) => {
    server.on('listening', () => {
      state.port = (server.address() as AddressInfo).port;
      resolve(state);
    });
  });
}
