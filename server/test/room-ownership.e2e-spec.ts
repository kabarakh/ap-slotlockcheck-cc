import request from 'supertest';
import type { App } from 'supertest/types.js';

import type { RoomAdminDto } from '../src/admins/dto/admins.dto.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SyncService } from '../src/sync/sync.service.js';
import { loadFixture } from './fixtures/fixtures.js';
import { CAROL, createRoom, login, OWNER, PLAYER } from './support/room.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('room ownership (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let bobCookie: string[];
  let carolCookie: string[];

  const me = (cookie: string[]) => request(server).get('/api/rooms/big-chill/me').set('Cookie', cookie).expect(200);
  const transfer = (cookie: string[], discordId: string, stayAdmin: boolean) =>
    request(server).post('/api/rooms/big-chill/owner').set('Cookie', cookie).send({ discordId, stayAdmin });

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as App;
    ownerCookie = await login(server, OWNER);
    bobCookie = await login(server, PLAYER);
    carolCookie = await login(server, CAROL);
    await createRoom(server, ownerCookie);
    await request(server)
      .post('/api/rooms/big-chill/admins')
      .set('Cookie', ownerCookie)
      .send({ discordId: PLAYER.discordId, role: 'helper' })
      .expect(201);
    await request(server)
      .post('/api/rooms/big-chill/admins')
      .set('Cookie', ownerCookie)
      .send({ discordId: CAROL.discordId, role: 'admin' })
      .expect(201);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('lets helpers and admins leave the room, but not the owner', async () => {
    await request(server).post('/api/rooms/big-chill/leave').set('Cookie', bobCookie).expect(204);
    expect((await me(bobCookie)).body).toEqual({ role: 'player', isOwner: false });
    const owner = await request(server).post('/api/rooms/big-chill/leave').set('Cookie', ownerCookie).expect(409);
    expect(owner.body).toMatchObject({ code: 'OWNER_CANNOT_LEAVE' });
    await request(server).post('/api/rooms/big-chill/leave').set('Cookie', bobCookie).expect(403);
  });

  it('lets only the owner transfer the room to a player or admin', async () => {
    expect((await transfer(carolCookie, PLAYER.discordId, true).expect(403)).body).toMatchObject({
      code: 'OWNER_REQUIRED',
    });
    expect((await transfer(ownerCookie, OWNER.discordId, true).expect(400)).body).toMatchObject({
      code: 'ALREADY_OWNER',
    });
    expect((await transfer(ownerCookie, '100000000000000077', true).expect(400)).body).toMatchObject({
      code: 'NOT_A_PLAYER',
    });
  });

  it('keeps the old owner as admin on request', async () => {
    const admins = (await transfer(ownerCookie, CAROL.discordId, true).expect(200)).body as RoomAdminDto[];
    expect(admins).toContainEqual(expect.objectContaining({ discordId: CAROL.discordId, isOwner: true }));
    expect((await me(ownerCookie)).body).toEqual({ role: 'admin', isOwner: false });
    expect((await me(carolCookie)).body).toEqual({ role: 'admin', isOwner: true });
  });

  it('removes the old owner on request', async () => {
    await transfer(carolCookie, PLAYER.discordId, false).expect(200);
    expect((await me(carolCookie)).body).toEqual({ role: 'player', isOwner: false });
    expect((await me(bobCookie)).body).toEqual({ role: 'admin', isOwner: true });
  });

  it('takes the new owner of the Cheese tracker in the synchronization', async () => {
    const tracker = loadFixture('cheese-tracker') as {
      owner_ct_user_id: number;
      owner_discord_username: string;
      games: { name: string; claimed_by_ct_user_id?: number }[];
    };
    tracker.owner_ct_user_id = 9;
    tracker.owner_discord_username = 'carol';
    tracker.games = tracker.games.map((game) => (game.name === 'Carol' ? { ...game, claimed_by_ct_user_id: 9 } : game));
    testApp.fixtureOverrides.set('cheese-tracker', tracker);
    const room = (await request(server).get('/api/rooms/big-chill').expect(200)).body as { id: number };
    await expect(testApp.app.get(SyncService).syncRoom(room.id, 'schedule')).resolves.toBe('success');
    expect((await me(carolCookie)).body).toEqual({ role: 'admin', isOwner: true });
    expect((await me(bobCookie)).body).toEqual({ role: 'admin', isOwner: false });
    await expect(testApp.app.get(SyncService).syncRoom(room.id, 'schedule')).resolves.toBe('success');
    expect((await me(carolCookie)).body).toEqual({ role: 'admin', isOwner: true });
    testApp.fixtureOverrides.delete('cheese-tracker');
  });

  it('deletes the room only for the owner and with the correct title', async () => {
    await request(server)
      .delete('/api/rooms/big-chill')
      .set('Cookie', bobCookie)
      .send({ title: 'Big Chill' })
      .expect(403);
    const wrong = await request(server)
      .delete('/api/rooms/big-chill')
      .set('Cookie', carolCookie)
      .send({ title: 'big chill' })
      .expect(400);
    expect(wrong.body).toMatchObject({ code: 'ROOM_TITLE_MISMATCH' });
    await request(server)
      .delete('/api/rooms/big-chill')
      .set('Cookie', carolCookie)
      .send({ title: 'Big Chill' })
      .expect(204);
    await request(server).get('/api/rooms/big-chill').expect(404);
    const prisma = testApp.app.get(PrismaService);
    expect(await prisma.slot.count()).toBe(0);
    expect(await prisma.roomAdmin.count()).toBe(0);
  });
});
