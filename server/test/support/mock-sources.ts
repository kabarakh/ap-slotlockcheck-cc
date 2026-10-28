import { createServer, type Server } from 'node:http';

import { loadFixture, type FixtureName } from '../fixtures/fixtures.ts';

export const MOCK_CHEESE_TRACKER_ID = 'AbCdEfGhIjKlMnOpQrStUv';
export const MOCK_ASYNC_CHEESE_TRACKER_ID = 'AsyncTrackerNoSlotLock';

function fixtureForPath(path: string, origin: string): unknown {
  const routes: [RegExp, FixtureName][] = [
    [/^\/api\/tracker\/[^/]+\/checks_history$/, 'cheese-checks-history'],
    [/^\/api\/room_status\//, 'ap-room-status'],
    [/^\/api\/static_tracker\//, 'ap-static-tracker'],
    [/^\/api\/slot_data_tracker\//, 'ap-slot-data'],
    [/^\/api\/datapackage\//, 'ap-datapackage-slotlock'],
  ];
  const route = routes.find(([pattern]) => pattern.test(path));
  if (route) {
    return loadFixture(route[1]);
  }
  if ([MOCK_CHEESE_TRACKER_ID, MOCK_ASYNC_CHEESE_TRACKER_ID].some((id) => path === `/api/tracker/${id}`)) {
    const tracker = loadFixture('cheese-tracker') as Record<string, unknown>;
    return {
      ...tracker,
      upstream_url: `${origin}/tracker/TrackerIdOfTheRoom0001`,
      room_link: `${origin}/room/RoomIdOfTheRoomXX0001`,
    };
  }
  return path.startsWith('/api/tracker/') ? loadFixture('ap-tracker') : undefined;
}

export function startMockSources(port: number): Promise<Server> {
  const origin = `http://127.0.0.1:${port}`;
  const server = createServer((request, response) => {
    const body = fixtureForPath(new URL(request.url ?? '/', origin).pathname, origin);
    response.writeHead(body === undefined ? 404 : 200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body ?? { error: 'not found' }));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
