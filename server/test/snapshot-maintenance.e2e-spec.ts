import request from 'supertest';
import type { App } from 'supertest/types.js';

import { PrismaService } from '../src/prisma/prisma.service.js';
import { SnapshotMaintenanceService } from '../src/sync/snapshot-maintenance.service.js';
import { snapshotPayloadText } from '../src/sync/snapshot-payload.js';
import { SyncService } from '../src/sync/sync.service.js';
import { loadFixture } from './fixtures/fixtures.js';
import { createRoom, login, OWNER } from './support/room.js';
import { createTestApp, type TestApp } from './support/test-app.js';

interface CheeseGameFixture {
  id: number;
  progression_status: string;
}

const DAY_MS = 86_400_000;

describe('snapshot maintenance (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let prisma: PrismaService;
  let roomId: number;

  const maintain = (now: Date) => testApp.app.get(SnapshotMaintenanceService).maintain(now);

  const syncWithStatus = async (progressionStatus: string) => {
    const cheeseFixture = loadFixture('cheese-tracker') as { games: CheeseGameFixture[]; updated_at: string };
    testApp.fixtureOverrides.set('cheese-tracker', {
      ...cheeseFixture,
      updated_at: new Date().toISOString(),
      games: cheeseFixture.games.map((game) =>
        game.id === 102 ? { ...game, progression_status: progressionStatus } : game,
      ),
    });
    await expect(testApp.app.get(SyncService).syncRoom(roomId, 'schedule')).resolves.toBe('success');
    testApp.fixtureOverrides.delete('cheese-tracker');
  };

  const countBySource = async () =>
    Object.fromEntries(
      (await prisma.syncSnapshot.groupBy({ by: ['source'], where: { roomId }, _count: { _all: true } })).map(
        (group) => [group.source, group._count._all],
      ),
    );

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as App;
    ownerCookie = await login(server, OWNER);
    await createRoom(server, ownerCookie);
    prisma = testApp.app.get(PrismaService);
    roomId = (await prisma.room.findUniqueOrThrow({ where: { slug: 'big-chill' } })).id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('saves new snapshots compressed', async () => {
    const snapshots = await prisma.syncSnapshot.findMany({ where: { roomId } });
    expect(snapshots.length).toBeGreaterThan(0);
    for (const snapshot of snapshots) {
      expect(snapshot.payload).toBeNull();
      expect(snapshot.compressedPayload).not.toBeNull();
      const text = await snapshotPayloadText(snapshot);
      expect(() => JSON.parse(text) as unknown).not.toThrow();
    }
  });

  it('saves no new cheese snapshot when only the update time changes', async () => {
    const before = await countBySource();
    await syncWithStatus('soft_bk');
    await syncWithStatus('soft_bk');
    const after = await countBySource();
    expect(after['cheese']).toBe((before['cheese'] ?? 0) + 1);
  });

  it('compresses snapshots that were saved without compression', async () => {
    const snapshot = await prisma.syncSnapshot.findFirstOrThrow({ where: { roomId, source: 'cheese' } });
    const text = await snapshotPayloadText(snapshot);
    await prisma.syncSnapshot.update({ where: { id: snapshot.id }, data: { payload: text, compressedPayload: null } });
    const result = await maintain(new Date());
    expect(result.compressedSnapshots).toBe(1);
    const compressed = await prisma.syncSnapshot.findUniqueOrThrow({ where: { id: snapshot.id } });
    expect(compressed.payload).toBeNull();
    expect(await snapshotPayloadText(compressed)).toBe(text);
  });

  it('keeps recent snapshots', async () => {
    const before = await countBySource();
    const result = await maintain(new Date());
    expect(result.removedSnapshots).toBe(0);
    expect(await countBySource()).toEqual(before);
  });

  it('keeps old snapshots that pace has not read yet', async () => {
    await syncWithStatus('go');
    await prisma.paceSignalState.delete({ where: { roomId } });
    const before = await countBySource();
    await maintain(new Date(Date.now() + 30 * DAY_MS));
    const after = await countBySource();
    expect(after['cheese']).toBe(before['cheese']);
    expect(after['ap_tracker']).toBe(before['ap_tracker']);
  });

  it('removes old read snapshots and keeps the pace values', async () => {
    const pace = async () =>
      (await request(server).get('/api/rooms/big-chill/pace').set('Cookie', ownerCookie).expect(200)).body as {
        slots: unknown[];
      };
    await syncWithStatus('go');
    const before = await pace();
    expect(Math.max(...Object.values(await countBySource()))).toBeGreaterThan(1);
    const result = await maintain(new Date(Date.now() + 30 * DAY_MS));
    expect(result.removedSnapshots).toBeGreaterThan(0);
    expect(result.removedSyncRuns).toBeGreaterThan(0);
    expect(Object.values(await countBySource()).every((count) => count === 1)).toBe(true);
    const room = await prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    expect(room.snapshotsPrunedAt).not.toBeNull();
    const snapshots = await prisma.syncSnapshot.findMany({ where: { roomId } });
    const runs = await prisma.syncRun.findMany({ where: { roomId }, select: { id: true } });
    const runIds = new Set(runs.map((run) => run.id));
    expect(snapshots.every((snapshot) => runIds.has(snapshot.firstSyncRunId))).toBe(true);
    expect((await pace()).slots).toEqual(before.slots);
  });

  it('removes all snapshots and synchronization runs of an archived room and keeps the pace values', async () => {
    await syncWithStatus('soft_bk');
    await prisma.room.update({ where: { id: roomId }, data: { archivedAt: new Date() } });
    const pace = async () =>
      (await request(server).get('/api/rooms/big-chill/pace').set('Cookie', ownerCookie).expect(200)).body as {
        slots: unknown[];
      };
    const before = await pace();
    await prisma.paceSignalState.delete({ where: { roomId } });
    const result = await maintain(new Date());
    expect(result.removedSnapshots).toBeGreaterThan(0);
    expect(await prisma.syncSnapshot.count({ where: { roomId } })).toBe(0);
    expect(await prisma.syncRun.count({ where: { roomId } })).toBe(0);
    expect(await prisma.paceSignalState.findUnique({ where: { roomId } })).not.toBeNull();
    expect((await pace()).slots).toEqual(before.slots);

    await prisma.room.update({ where: { id: roomId }, data: { archivedAt: null } });
    await syncWithStatus('go');
    expect(await prisma.syncSnapshot.count({ where: { roomId } })).toBeGreaterThan(0);
  });
});
