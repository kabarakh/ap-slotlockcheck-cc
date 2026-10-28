import { Logger } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import type { RoomPaceDto, SlotPaceDto } from '../src/pace/dto/pace.dto.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CheeseService } from '../src/sources/cheese/cheese.service.js';
import { CAROL, createRoom, login, OWNER, PLAYER, STRANGER } from './support/room.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const EMPTY_VALUES = {
  hasRange: false,
  from: null,
  to: null,
  activeMinutes: null,
  checks: null,
  checksPerHour: null,
  minutesPerCheck: null,
  bkMinutes: null,
  bkShare: null,
  bkCount: null,
  longestBkMinutes: null,
  breakMinutes: null,
  startKind: null,
};

describe('pace statistics (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let playerCookie: string[];
  let carolCookie: string[];

  const pace = (cookie: string[] = []) => request(server).get('/api/rooms/big-chill/pace').set('Cookie', cookie);

  const rowsByName = (body: RoomPaceDto): Record<string, SlotPaceDto> =>
    Object.fromEntries(body.slots.map((slot) => [slot.name, slot]));

  const withoutTimes = ({ calculatedAt: _calculatedAt, slots, ...body }: RoomPaceDto) => ({
    ...body,
    slots: slots.map(({ to: _to, ...slot }) => slot),
  });

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as App;
    ownerCookie = await login(server, OWNER);
    playerCookie = await login(server, PLAYER);
    carolCookie = await login(server, CAROL);
    await createRoom(server, ownerCookie);
    await request(server)
      .post('/api/rooms/big-chill/admins')
      .set('Cookie', ownerCookie)
      .send({ discordId: CAROL.discordId, role: 'helper' })
      .expect(201);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await testApp.close();
  });

  it('gives 503 if the checks history of Cheese is not available', async () => {
    testApp.fixtureOverrides.set('cheese-checks-history', { broken: true });
    const response = await pace(ownerCookie).expect(503);
    expect(response.body).toMatchObject({ statusCode: 503, code: 'CHECKS_HISTORY_NOT_AVAILABLE' });
    testApp.fixtureOverrides.delete('cheese-checks-history');
  });

  it('gives the pace statistics only to admins and helpers', async () => {
    await pace(ownerCookie).expect(200);
    await pace(carolCookie).expect(200);
    await pace(playerCookie).expect(403);
    await pace(await login(server, STRANGER)).expect(403);
    await pace().expect(403);
  });

  it('gives the rows of the slots and the values of the games', async () => {
    const body = (await pace(ownerCookie).expect(200)).body as RoomPaceDto;
    expect(Object.keys(body).sort()).toEqual(['calculatedAt', 'games', 'limits', 'signalsFrom', 'slots']);
    expect(body.limits).toEqual({ breakLimitMinutes: 30, bulkLimitChecks: 40 });
    expect(new Date(body.calculatedAt).toISOString()).toBe(body.calculatedAt);
    expect(body.signalsFrom).not.toBeNull();
    expect(body.slots.map((slot) => slot.name)).toEqual(['Alice', 'Bob', 'Carol', 'Davey (Dave)']);
    const rows = rowsByName(body);
    expect(Object.keys(rows['Alice'] ?? {}).sort()).toEqual([
      'activeMinutes',
      'bkCount',
      'bkMinutes',
      'bkShare',
      'breakMinutes',
      'checks',
      'checksPerHour',
      'discordName',
      'discordUserId',
      'from',
      'game',
      'hasRange',
      'longestBkMinutes',
      'minutesPerCheck',
      'name',
      'partialSignals',
      'slotId',
      'startKind',
      'to',
    ]);
    expect(rows['Alice']).toMatchObject({
      hasRange: true,
      from: '2026-10-21T14:30:00.000Z',
      activeMinutes: 0,
      checks: 0,
      checksPerHour: null,
      bkMinutes: 0,
      bkShare: null,
      breakMinutes: 0,
      startKind: 'estimated',
    });
    expect(body.games).toEqual([
      {
        game: 'A Link to the Past',
        slotCount: 1,
        activeMinutes: 0,
        checks: 0,
        checksPerHour: null,
        medianChecksPerHour: null,
      },
      { game: 'Celeste', slotCount: 0, activeMinutes: 0, checks: 0, checksPerHour: null, medianChecksPerHour: null },
      { game: 'Factorio', slotCount: 0, activeMinutes: 0, checks: 0, checksPerHour: null, medianChecksPerHour: null },
      {
        game: 'Hollow Knight',
        slotCount: 0,
        activeMinutes: 0,
        checks: 0,
        checksPerHour: null,
        medianChecksPerHour: null,
      },
    ]);
  });

  it('gives slots without time range as one row without values with the current Discord user', async () => {
    const rows = rowsByName((await pace(ownerCookie).expect(200)).body as RoomPaceDto);
    expect(rows['Bob']).toMatchObject({ ...EMPTY_VALUES, discordUserId: PLAYER.discordId, discordName: 'bob' });
    expect(rows['Carol']).toMatchObject({ ...EMPTY_VALUES, discordUserId: CAROL.discordId, discordName: 'carol' });
    expect(rows['Davey (Dave)']).toMatchObject({ ...EMPTY_VALUES, discordUserId: null });
  });

  it('skips a snapshot that cannot be read and calculates the values', async () => {
    const before = (await pace(ownerCookie).expect(200)).body as RoomPaceDto;
    const prisma = testApp.app.get(PrismaService);
    const room = await prisma.room.findUniqueOrThrow({ where: { slug: 'big-chill' } });
    const run = await prisma.syncRun.create({
      data: { roomId: room.id, trigger: 'manual', startedAt: new Date(), result: 'failed' },
    });
    const snapshot = await prisma.syncSnapshot.create({
      data: {
        roomId: room.id,
        source: 'cheese',
        hash: 'unreadable',
        payload: 'not json',
        firstSyncRunId: run.id,
        lastSyncRunId: run.id,
      },
    });
    await prisma.room.update({ where: { id: room.id }, data: { lastSuccessfulSyncAt: new Date() } });
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const after = (await pace(ownerCookie).expect(200)).body as RoomPaceDto;
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`Snapshot ${snapshot.id} `));
    expect(withoutTimes(after)).toEqual(withoutTimes(before));
  });

  it('calculates the values again after an admin changes an unlock time', async () => {
    const before = (await pace(ownerCookie).expect(200)).body as RoomPaceDto;
    const prisma = testApp.app.get(PrismaService);
    const room = await prisma.room.findUniqueOrThrow({ where: { slug: 'big-chill' } });
    const locker = await prisma.slot.findFirstOrThrow({ where: { roomId: room.id, name: 'Locker' } });
    const checksHistory = vi.spyOn(testApp.app.get(CheeseService), 'getChecksHistory');
    expect((await pace(ownerCookie).expect(200)).body).toEqual(before);
    await request(server)
      .put('/api/rooms/big-chill/unlock-times')
      .set('Cookie', ownerCookie)
      .send({
        lockerSlotId: locker.id,
        lockedSlotId: rowsByName(before)['Alice']?.slotId,
        unlockTime: '2026-10-21T12:00:00Z',
      })
      .expect(204);
    const after = (await pace(ownerCookie).expect(200)).body as RoomPaceDto;
    expect(after.calculatedAt).not.toBe(before.calculatedAt);
    expect(rowsByName(after)['Alice']).toMatchObject({ from: '2026-10-21T12:00:00.000Z', startKind: 'unlock' });
    expect(checksHistory).not.toHaveBeenCalled();
  });
});
