import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { SlotRowDto } from '../src/rooms/dto/slot-row.dto.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const TRACKER_ID = 'AbCdEfGhIjKlMnOpQrStUv';
const OWNER = { discordId: '100000000000000001', name: 'Alice', username: 'alice_owner' };
const PLAYER = { discordId: '100000000000000002', name: 'Bob', username: 'bob' };

describe('rooms (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let playerCookie: string[];

  const login = async (user: typeof OWNER): Promise<string[]> => {
    const response = await request(server).post('/api/auth/test-login').send(user).expect(200);
    return response.get('Set-Cookie') ?? [];
  };

  const roster = async (): Promise<Record<string, SlotRowDto>> => {
    const response = await request(server).get('/api/rooms/big-chill/roster').expect(200);
    return Object.fromEntries((response.body as SlotRowDto[]).map((row) => [row.name, row]));
  };

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as App;
    ownerCookie = await login(OWNER);
    playerCookie = await login(PLAYER);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('rejects room setup without login', async () => {
    await request(server).post('/api/room-setup/preview').send({ cheeseTrackerId: TRACKER_ID }).expect(401);
  });

  it('shows a preview with the owner check and the SlotLock slots', async () => {
    const response = await request(server)
      .post('/api/room-setup/preview')
      .set('Cookie', ownerCookie)
      .send({ cheeseTrackerId: TRACKER_ID })
      .expect(201);
    expect(response.body).toMatchObject({
      title: 'Big Chill Test',
      suggestedSlug: 'big-chill-test',
      ownerCheck: 'slot',
      slotLockSlots: [
        { position: 1, name: 'Locker' },
        { position: 6, name: 'Locker2' },
      ],
    });
  });

  it('refuses room creation by a user who is not the tracker owner', async () => {
    await request(server)
      .post('/api/room-setup')
      .set('Cookie', playerCookie)
      .send({ cheeseTrackerId: TRACKER_ID, slug: 'big-chill', title: 'Big Chill', slotLockPositions: [1, 6] })
      .expect(403);
  });

  it('creates a room and synchronizes it', async () => {
    const response = await request(server)
      .post('/api/room-setup')
      .set('Cookie', ownerCookie)
      .send({ cheeseTrackerId: TRACKER_ID, slug: 'big-chill', title: 'Big Chill', slotLockPositions: [1, 6] })
      .expect(201);
    expect(response.body).toMatchObject({
      slug: 'big-chill',
      slotCount: 6,
      lockedSlotCount: 4,
      unlockedSlotCount: 1,
      unlockedPercentage: 25,
      yellowLimitHours: 24,
      redLimitHours: 48,
    });
    const rows = await roster();
    expect(rows['Alice']).toMatchObject({
      lockStatus: 'unlocked',
      unlockTime: '2026-10-21T14:30:00.000Z',
      unlockTimeSource: 'estimated',
    });
    expect(rows['Alice']?.locks[0]).toMatchObject({ lockerName: 'Locker', senderName: 'Bob' });
    expect(rows['Bob']?.lockStatus).toBe('locked');
    expect(rows['Carol']?.lockStatus).toBe('partially_unlocked');
    expect(rows['Dave']?.lockStatus).toBe('locked');
    expect(rows['Locker']?.lockStatus).toBe('not_locked');
  });

  it('lists the room', async () => {
    const response = await request(server).get('/api/rooms').expect(200);
    expect(response.body).toHaveLength(1);
  });

  it('gives the roles of the users', async () => {
    await request(server).get('/api/rooms/big-chill/me').expect(200, { role: 'visitor', isOwner: false });
    await request(server)
      .get('/api/rooms/big-chill/me')
      .set('Cookie', playerCookie)
      .expect(200, { role: 'player', isOwner: false });
    await request(server)
      .get('/api/rooms/big-chill/me')
      .set('Cookie', ownerCookie)
      .expect(200, { role: 'admin', isOwner: true });
  });

  it('blocks a manual synchronization during the cooldown', async () => {
    const response = await request(server).post('/api/rooms/big-chill/sync').set('Cookie', ownerCookie).expect(429);
    expect(response.body).toMatchObject({ code: 'SYNC_TOO_EARLY' });
  });

  it('records the unlock time of a new unlock item', async () => {
    const tracker = (await import('./fixtures/fixtures.js')).loadFixture('ap-tracker') as {
      player_items_received: { player: number; items: number[][] }[];
    };
    tracker.player_items_received[0]?.items.push([1004, 20005, 2, 1]);
    testApp.fixtureOverrides.set('ap-tracker', tracker);
    const { SyncService } = await import('../src/sync/sync.service.js');
    const room = (await request(server).get('/api/rooms/big-chill').expect(200)).body as { id: number };
    await expect(testApp.app.get(SyncService).syncRoom(room.id, 'schedule')).resolves.toBe('success');
    const rows = await roster();
    expect(rows['Bob']).toMatchObject({ lockStatus: 'unlocked', unlockTimeSource: 'sync' });
    testApp.fixtureOverrides.delete('ap-tracker');
  });

  it('lets only admins give warnings', async () => {
    const rows = await roster();
    const warning = { slotId: rows['Dave']?.id, date: '2026-10-24T10:00:00Z', text: 'Inactive' };
    await request(server).post('/api/rooms/big-chill/warnings').set('Cookie', playerCookie).send(warning).expect(403);
    await request(server).post('/api/rooms/big-chill/warnings').set('Cookie', ownerCookie).send(warning).expect(201);
    expect((await roster())['Dave']?.warningCount).toBe(1);
  });

  it('imports unlock times from CSV', async () => {
    const response = await request(server)
      .post('/api/rooms/big-chill/unlock-times/csv')
      .set('Cookie', ownerCookie)
      .send({ csv: 'slot,locker,unlock_time\nAlice,Locker,2026-10-21 12:00\nNobody,,2026-10-21 12:00' })
      .expect(200);
    expect(response.body).toEqual({ updated: 1, errors: ['Line 3: unknown slot "Nobody"'] });
    expect((await roster())['Alice']).toMatchObject({
      unlockTime: '2026-10-21T12:00:00.000Z',
      unlockTimeSource: 'csv',
    });
  });

  it('lets an admin change the lock assignment', async () => {
    const rows = await roster();
    await request(server)
      .put('/api/rooms/big-chill/lock-assignments')
      .set('Cookie', ownerCookie)
      .send({ lockerSlotId: rows['Locker']?.id, lockedSlotId: rows['Dave']?.id, locked: true })
      .expect(200);
    await request(server)
      .put('/api/rooms/big-chill/lock-assignments')
      .set('Cookie', ownerCookie)
      .send({ lockerSlotId: rows['Locker']?.id, lockedSlotId: rows['Carol']?.id, locked: false })
      .expect(200);
    const updated = await roster();
    expect(updated['Dave']?.locks).toHaveLength(2);
    expect(updated['Carol']?.lockStatus).toBe('unlocked');
  });

  it('keeps the tracker owner as admin', async () => {
    const admins = await request(server).get('/api/rooms/big-chill/admins').set('Cookie', ownerCookie).expect(200);
    const owner = (admins.body as { userId: number; isOwner: boolean }[]).find((admin) => admin.isOwner);
    await request(server).delete(`/api/rooms/big-chill/admins/${owner?.userId}`).set('Cookie', ownerCookie).expect(409);
    await request(server)
      .post('/api/rooms/big-chill/admins')
      .set('Cookie', ownerCookie)
      .send({ discordId: PLAYER.discordId })
      .expect(201);
    await request(server)
      .get('/api/rooms/big-chill/me')
      .set('Cookie', playerCookie)
      .expect(200, { role: 'admin', isOwner: false });
  });
});
