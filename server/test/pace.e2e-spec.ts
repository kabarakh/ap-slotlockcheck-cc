import { Logger } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import type { RoomPaceDto, SlotPaceDto, SlotTimelineDto } from '../src/pace/dto/pace.dto.js';
import { PaceSignalsService } from '../src/pace/pace-signals.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CheeseService } from '../src/sources/cheese/cheese.service.js';
import { SyncService } from '../src/sync/sync.service.js';
import { loadFixture } from './fixtures/fixtures.js';
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

const LAST_HISTORY_POINT = '2026-10-22T09:00:00.000Z';
const HISTORY_STEP_MS = 10 * 60_000;

const lastGridPoint = (calculatedAt: string) => {
  const last = Date.parse(LAST_HISTORY_POINT);
  return new Date(
    last + Math.floor((Date.parse(calculatedAt) - last) / HISTORY_STEP_MS) * HISTORY_STEP_MS,
  ).toISOString();
};

interface CheeseGameFixture {
  id: number;
  progression_status: string;
}

interface TrackerItemsFixture {
  player: number;
  items: number[][];
}

const minutesBetween = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 60_000;

describe('pace statistics (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let playerCookie: string[];
  let carolCookie: string[];

  const pace = (cookie: string[] = []) => request(server).get('/api/rooms/big-chill/pace').set('Cookie', cookie);

  const timeline = (slotId: number | undefined, cookie: string[] = ownerCookie) =>
    request(server).get(`/api/rooms/big-chill/pace/slots/${slotId}`).set('Cookie', cookie);

  const rowsByName = (body: RoomPaceDto): Record<string, SlotPaceDto> =>
    Object.fromEntries(body.slots.map((slot) => [slot.name, slot]));

  const withoutTimes = ({ calculatedAt: _calculatedAt, slots, ...body }: RoomPaceDto) => ({
    ...body,
    slots: slots.map(({ to: _to, ...slot }) => slot),
  });

  const withNow = (body: SlotTimelineDto, calculatedAt: string): unknown =>
    JSON.parse(JSON.stringify(body).replaceAll(calculatedAt, 'now'));

  const signalState = async () => {
    const prisma = testApp.app.get(PrismaService);
    const room = await prisma.room.findUniqueOrThrow({ where: { slug: 'big-chill' } });
    return { prisma, room, state: await prisma.paceSignalState.findUnique({ where: { roomId: room.id } }) };
  };

  const lastSnapshotIds = async (prisma: PrismaService, roomId: number) => {
    const last = async (source: string) =>
      (await prisma.syncSnapshot.findFirstOrThrow({ where: { roomId, source }, orderBy: { id: 'desc' } })).id;
    return { cheese: await last('cheese'), ap_tracker: await last('ap_tracker') };
  };

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

  it('builds the saved signals of the room at the first request', async () => {
    const { prisma, room } = await signalState();
    await prisma.paceSignalState.delete({ where: { roomId: room.id } });
    await pace(ownerCookie).expect(200);
    const { state } = await signalState();
    expect(state).not.toBeNull();
    expect(JSON.parse(state?.lastSnapshotIds ?? '')).toEqual(await lastSnapshotIds(prisma, room.id));
    expect(JSON.parse(state?.unreadableSnapshots ?? '')).toEqual([]);
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
      breakMinutes:
        minutesBetween('2026-10-21T14:30:00.000Z', '2026-10-22T08:50:00.000Z') +
        minutesBetween(LAST_HISTORY_POINT, lastGridPoint(body.calculatedAt)),
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

  it('gives the timeline of a slot only to admins and helpers', async () => {
    const before = (await pace(ownerCookie).expect(200)).body as RoomPaceDto;
    const alice = rowsByName(before)['Alice'];
    const body = (await timeline(alice?.slotId, carolCookie).expect(200)).body as SlotTimelineDto;
    expect(Object.keys(body).sort()).toEqual([
      'from',
      'playerPeriods',
      'progressionItemTimes',
      'segments',
      'slotId',
      'statusChanges',
      'to',
      'unreadableSnapshots',
    ]);
    expect(body).toMatchObject({
      slotId: alice?.slotId,
      from: '2026-10-21T12:00:00.000Z',
      segments: [
        { kind: 'locked', from: '2026-10-20T10:00:00.000Z', to: '2026-10-21T12:00:00.000Z', checks: 0 },
        { kind: 'break', from: '2026-10-21T12:00:00.000Z', to: '2026-10-21T14:20:00.000Z', checks: 0 },
        { kind: 'active', from: '2026-10-21T14:20:00.000Z', to: '2026-10-21T14:30:00.000Z', checks: 5 },
        { kind: 'break', from: '2026-10-21T14:30:00.000Z', to: '2026-10-22T08:50:00.000Z', checks: 0 },
        { kind: 'bulk', from: '2026-10-22T08:50:00.000Z', to: LAST_HISTORY_POINT, checks: 115 },
        { kind: 'break', from: LAST_HISTORY_POINT, to: lastGridPoint(before.calculatedAt), checks: 0 },
      ],
      progressionItemTimes: [],
      statusChanges: [{ status: 'bk' }],
      playerPeriods: [{ discordUserId: OWNER.discordId, discordName: 'alice_owner' }],
    });
    expect(body.to).toBe(alice?.to);
    expect(body.unreadableSnapshots).toHaveLength(1);
    await timeline(alice?.slotId, ownerCookie).expect(200);
    await timeline(alice?.slotId, playerCookie).expect(403);
    await timeline(alice?.slotId, []).expect(403);
  });

  it('gives 404 for the timeline of a SlotLock slot, a slot of another room, an unknown slot and a slot without time range', async () => {
    const prisma = testApp.app.get(PrismaService);
    const { id: _id, ...room } = await prisma.room.findUniqueOrThrow({ where: { slug: 'big-chill' } });
    const locker = await prisma.slot.findFirstOrThrow({ where: { name: 'Locker' } });
    const { id: _slotId, roomId: _roomId, ...alice } = await prisma.slot.findFirstOrThrow({ where: { name: 'Alice' } });
    expect(locker.isSlotLock).toBe(true);
    const other = await prisma.room.create({ data: { ...room, slug: 'other-room', cheeseTrackerId: 'other-tracker' } });
    const foreign = await prisma.slot.create({ data: { ...alice, roomId: other.id } });
    const rows = rowsByName((await pace(ownerCookie).expect(200)).body as RoomPaceDto);
    for (const slotId of [locker.id, foreign.id, 999_999, rows['Bob']?.slotId]) {
      const response = await timeline(slotId).expect(404);
      expect(response.body).toMatchObject({ statusCode: 404, code: 'SLOT_NOT_FOUND' });
    }
    await timeline(undefined).expect(400);
  });

  it('reads only the new snapshots after a synchronization and gives the result of a full read', async () => {
    const { prisma, room } = await signalState();
    const alice = rowsByName((await pace(ownerCookie).expect(200)).body as RoomPaceDto)['Alice'];
    const oldSnapshots = await prisma.syncSnapshot.findMany({
      where: { roomId: room.id, source: { in: ['cheese', 'ap_tracker'] } },
    });
    await prisma.syncSnapshot.updateMany({
      where: { id: { in: oldSnapshots.map((snapshot) => snapshot.id) } },
      data: { payload: 'old payload' },
    });
    const cheeseFixture = loadFixture('cheese-tracker') as { games: CheeseGameFixture[] };
    const trackerFixture = loadFixture('ap-tracker') as { player_items_received: TrackerItemsFixture[] };
    testApp.fixtureOverrides.set('cheese-tracker', {
      ...cheeseFixture,
      games: cheeseFixture.games.map((game) => (game.id === 102 ? { ...game, progression_status: 'go' } : game)),
    });
    testApp.fixtureOverrides.set('ap-tracker', {
      ...trackerFixture,
      player_items_received: trackerFixture.player_items_received.map((entry) =>
        entry.player === 2 ? { ...entry, items: [...entry.items, [43, 78, 3, 1]] } : entry,
      ),
    });
    const warn = vi.spyOn(Logger.prototype, 'warn');
    warn.mockClear();
    await expect(testApp.app.get(SyncService).syncRoom(room.id, 'schedule')).resolves.toBe('success');
    testApp.fixtureOverrides.delete('cheese-tracker');
    testApp.fixtureOverrides.delete('ap-tracker');
    const run = await prisma.syncRun.findFirstOrThrow({ where: { roomId: room.id }, orderBy: { id: 'desc' } });
    const { state } = await signalState();
    expect(JSON.parse(state?.lastSnapshotIds ?? '')).toEqual(await lastSnapshotIds(prisma, room.id));
    const incremental = (await pace(ownerCookie).expect(200)).body as RoomPaceDto;
    const incrementalTimeline = (await timeline(alice?.slotId).expect(200)).body as SlotTimelineDto;
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('cannot be read'));
    expect(incrementalTimeline.statusChanges.map((change) => change.status)).toEqual(['bk', 'go']);
    expect(incrementalTimeline.statusChanges[1]?.time).toBe(run.startedAt.toISOString());
    expect(incrementalTimeline.progressionItemTimes).toEqual([run.startedAt.toISOString()]);
    expect(incrementalTimeline.unreadableSnapshots).toEqual([
      { from: expect.any(String) as string, to: run.startedAt.toISOString() },
    ]);

    for (const snapshot of oldSnapshots) {
      await prisma.syncSnapshot.update({ where: { id: snapshot.id }, data: { payload: snapshot.payload } });
    }
    await prisma.paceSignalState.delete({ where: { roomId: room.id } });
    await prisma.room.update({ where: { id: room.id }, data: { lastSuccessfulSyncAt: new Date() } });
    const full = (await pace(ownerCookie).expect(200)).body as RoomPaceDto;
    const fullTimeline = (await timeline(alice?.slotId).expect(200)).body as SlotTimelineDto;
    expect(withoutTimes(full)).toEqual(withoutTimes(incremental));
    expect(withNow(fullTimeline, full.calculatedAt)).toEqual(withNow(incrementalTimeline, incremental.calculatedAt));
  });

  it('reads each snapshot one time when two updates of the signals run at the same time', async () => {
    const { prisma, room } = await signalState();
    await prisma.paceSignalState.delete({ where: { roomId: room.id } });
    const warn = vi.spyOn(Logger.prototype, 'warn');
    warn.mockClear();
    const signals = testApp.app.get(PaceSignalsService);
    const [first, second] = await Promise.all([signals.updateSignals(room), signals.updateSignals(room)]);
    expect(warn.mock.calls.filter(([message]) => String(message).includes('cannot be read'))).toHaveLength(1);
    expect(second.lastSnapshotIds).toEqual(first.lastSnapshotIds);
    expect(second.unreadableSnapshots).toEqual(first.unreadableSnapshots);
  });

  it('deletes the saved signals with the room', async () => {
    const { prisma, room, state } = await signalState();
    expect(state).not.toBeNull();
    await request(server)
      .delete('/api/rooms/big-chill')
      .set('Cookie', ownerCookie)
      .send({ title: room.title })
      .expect(204);
    expect(await prisma.paceSignalState.count({ where: { roomId: room.id } })).toBe(0);
  });
});
