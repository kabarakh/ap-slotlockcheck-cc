import request from 'supertest';
import type { App } from 'supertest/types.js';

import type { RoomDetailDto, RoomListEntryDto } from '../src/rooms/dto/room.dto.js';
import { SyncService } from '../src/sync/sync.service.js';
import { loadFixture } from './fixtures/fixtures.js';
import { createRoom, login, OWNER, PLAYER } from './support/room.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('room archive (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let helperCookie: string[];
  let roomId: number;

  const room = async (): Promise<RoomDetailDto> =>
    (await request(server).get('/api/rooms/big-chill').expect(200)).body as RoomDetailDto;
  const sync = () => testApp.app.get(SyncService).syncRoom(roomId, 'schedule');

  const finishAllPlayableSlots = () => {
    const tracker = loadFixture('cheese-tracker') as { games: { game: string; completion_status: string }[] };
    tracker.games = tracker.games.map((game) =>
      game.game === 'SlotLock' ? game : { ...game, completion_status: 'goal' },
    );
    testApp.fixtureOverrides.set('cheese-tracker', tracker);
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as App;
    ownerCookie = await login(server, OWNER);
    helperCookie = await login(server, PLAYER);
    await createRoom(server, ownerCookie);
    await request(server)
      .post('/api/rooms/big-chill/admins')
      .set('Cookie', ownerCookie)
      .send({ discordId: PLAYER.discordId, role: 'helper' })
      .expect(201);
    roomId = (await room()).id;
  });

  afterAll(async () => {
    await testApp.close();
  });

  afterEach(() => {
    testApp.fixtureOverrides.delete('cheese-tracker');
  });

  it('starts as an active room with the automatic archive on', async () => {
    expect(await room()).toMatchObject({ archivedAt: null, archiveReason: null, autoArchive: true });
    await expect(sync()).resolves.toBe('success');
    expect((await room()).archivedAt).toBeNull();
  });

  it('lets only admins archive a room', async () => {
    await request(server).post('/api/rooms/big-chill/archive').set('Cookie', helperCookie).expect(403);
    const archived = (await request(server).post('/api/rooms/big-chill/archive').set('Cookie', ownerCookie).expect(200))
      .body as RoomDetailDto;
    expect(archived).toMatchObject({ archiveReason: 'manual' });
    expect(archived.archivedAt).not.toBeNull();
    await request(server).post('/api/rooms/big-chill/archive').set('Cookie', ownerCookie).expect(409);
  });

  it('does not synchronize an archived room', async () => {
    const before = await room();
    await expect(sync()).resolves.toBe('skipped');
    await request(server).post('/api/rooms/big-chill/sync').set('Cookie', ownerCookie).expect(409);
    expect((await room()).syncStatus.lastSyncAt).toBe(before.syncStatus.lastSyncAt);
    const list = (await request(server).get('/api/rooms').set('Cookie', ownerCookie).expect(200))
      .body as RoomListEntryDto[];
    expect(list[0]).toMatchObject({ archiveReason: 'manual' });
  });

  it('reopens a manually archived room and keeps the automatic archive', async () => {
    await request(server).delete('/api/rooms/big-chill/archive').set('Cookie', helperCookie).expect(403);
    const reopened = (
      await request(server).delete('/api/rooms/big-chill/archive').set('Cookie', ownerCookie).expect(200)
    ).body as RoomDetailDto;
    expect(reopened).toMatchObject({ archivedAt: null, archiveReason: null, autoArchive: true });
    await request(server).delete('/api/rooms/big-chill/archive').set('Cookie', ownerCookie).expect(409);
  });

  it('archives the room automatically when all slots except the SlotLock slots are finished', async () => {
    finishAllPlayableSlots();
    await expect(sync()).resolves.toBe('success');
    const archived = await room();
    expect(archived).toMatchObject({ archiveReason: 'auto' });
    expect(archived.archivedAt).toBe(archived.syncStatus.lastSuccessfulSyncAt);
  });

  it('switches the automatic archive off when an automatic archive is reopened', async () => {
    finishAllPlayableSlots();
    const reopened = (
      await request(server).delete('/api/rooms/big-chill/archive').set('Cookie', ownerCookie).expect(200)
    ).body as RoomDetailDto;
    expect(reopened).toMatchObject({ archivedAt: null, autoArchive: false });
    await expect(sync()).resolves.toBe('success');
    expect((await room()).archivedAt).toBeNull();
  });

  it('saves the automatic archive in the settings', async () => {
    await request(server)
      .patch('/api/rooms/big-chill/settings')
      .set('Cookie', ownerCookie)
      .send({ autoArchive: true })
      .expect(204);
    expect((await room()).autoArchive).toBe(true);
  });
});
