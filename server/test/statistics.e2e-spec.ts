import request from 'supertest';
import type { App } from 'supertest/types.js';

import { PrismaService } from '../src/prisma/prisma.service.js';
import type { RoomDependenciesDto, RoomHistoryDto } from '../src/statistics/dto/statistics.dto.js';
import { generationOutputFixturePath } from './fixtures/fixtures.js';
import { createRoom, login, OWNER, PLAYER } from './support/room.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('statistics (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let playerCookie: string[];

  const get = (path: string, cookie: string[] = []) =>
    request(server).get(`/api/rooms/big-chill/statistics${path}`).set('Cookie', cookie);

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as App;
    ownerCookie = await login(server, OWNER);
    playerCookie = await login(server, PLAYER);
    await createRoom(server, ownerCookie);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('gives the history to all users', async () => {
    const body = (await get('/history').expect(200)).body as RoomHistoryDto;
    expect(body).toMatchObject({
      historyFrom: '2026-10-20T10:00:00.000Z',
      startedAt: '2026-10-21T14:30:00.000Z',
      bucketMinutes: 60,
      rateWindowHours: 24,
    });
    expect(body.buckets[0]).toEqual({
      time: '2026-10-20T10:00:00.000Z',
      checks: 0,
      newChecks: 0,
      activeSlots: 0,
      activePlayers: 0,
    });
    expect(body.buckets.at(-1)?.checks).toBeGreaterThan(0);
    expect(body.slots.length).toBeGreaterThan(0);
  });

  it('gives the dependencies only to helpers and admins', async () => {
    await get('/dependencies', playerCookie).expect(403);
    expect((await get('/dependencies', ownerCookie).expect(404)).body).toMatchObject({ code: 'SEED_NOT_FOUND' });
    await request(server)
      .post('/api/rooms/big-chill/seed')
      .set('Cookie', ownerCookie)
      .attach('file', generationOutputFixturePath('big-chill'))
      .expect(201);
    const prisma = testApp.app.get(PrismaService);
    const bob = await prisma.slot.findFirstOrThrow({ where: { name: 'Bob' } });
    const location = await prisma.seedLocation.findFirstOrThrow({
      where: { itemName: 'Unlock Alice', checked: false },
    });
    await prisma.seedLocation.update({ where: { id: location.id }, data: { itemName: 'Unlock Bob' } });
    const body = (await get('/dependencies', ownerCookie).expect(200)).body as RoomDependenciesDto;
    expect(body.blockers).toEqual([
      expect.objectContaining({ lockedSlotId: bob.id, finderSlotId: location.finderSlotId, sphere: location.sphere }),
    ]);
    expect(body.progressionFlow).toHaveLength(7);
    expect(body.progressionFlow.every((row) => row.open <= row.total)).toBe(true);
    expect(body.spheres.map((sphere) => [sphere.sphere, sphere.locationCount])).toEqual([
      [0, 5],
      [1, 4],
      [2, 4],
      [3, 2],
    ]);
  });
});
