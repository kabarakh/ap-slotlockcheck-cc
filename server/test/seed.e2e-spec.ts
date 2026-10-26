import request from 'supertest';
import type { App } from 'supertest/types.js';
import { LiveGateway } from '../src/live/live.gateway.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { SyncService } from '../src/sync/sync.service.js';
import { loadFixture, multidataFixturePath } from './fixtures/fixtures.js';
import { createRoom, login, OWNER, PLAYER } from './support/room.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('seed upload (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let playerCookie: string[];

  const upload = (cookie: string[], path: string) =>
    request(server).post('/api/rooms/big-chill/seed').set('Cookie', cookie).attach('file', path);

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

  it('has no seed data after the room setup', async () => {
    await request(server).get('/api/rooms/big-chill/seed').set('Cookie', ownerCookie).expect(404);
    const room = await request(server).get('/api/rooms/big-chill').expect(200);
    expect(room.body).toMatchObject({
      hasSeed: false,
      sphereOffset: 0,
      visitorsSeeLocations: false,
      playersMarkFiller: false,
    });
  });

  it('accepts uploads only from admins', async () => {
    const smallFile = Buffer.from([3]);
    await request(server).post('/api/rooms/big-chill/seed').attach('file', smallFile, 'AP_1.archipelago').expect(403);
    await request(server)
      .post('/api/rooms/big-chill/seed')
      .set('Cookie', playerCookie)
      .attach('file', smallFile, 'AP_1.archipelago')
      .expect(403);
    await request(server).get('/api/rooms/big-chill/seed').set('Cookie', playerCookie).expect(403);
  });

  it('rejects a request without a file', async () => {
    const response = await request(server).post('/api/rooms/big-chill/seed').set('Cookie', ownerCookie).expect(400);
    expect(response.body).toMatchObject({ code: 'SEED_FILE_MISSING' });
  });

  it('rejects a file that is not a multidata file', async () => {
    const response = await request(server)
      .post('/api/rooms/big-chill/seed')
      .set('Cookie', ownerCookie)
      .attach('file', Buffer.from('not a multidata file'), 'AP_1.archipelago')
      .expect(400);
    expect(response.body).toMatchObject({ code: 'UNSUPPORTED_MULTIDATA_VERSION' });
  });

  it('rejects the file of another room and saves nothing', async () => {
    const response = await upload(ownerCookie, multidataFixturePath('other-room')).expect(400);
    expect(response.body).toMatchObject({
      code: 'SEED_DOES_NOT_MATCH_ROOM',
      details: { differences: ['#2 Alice (A Link to the Past): Alicia (A Link to the Past) in the file'] },
    });
    expect(await testApp.app.get(PrismaService).seedLocation.count()).toBe(0);
  });

  it('saves the seed data and the locations', async () => {
    const response = await upload(ownerCookie, multidataFixturePath('big-chill')).expect(201);
    expect(response.body).toMatchObject({
      seedName: '12345678901234567890',
      archipelagoVersion: '0.6.8',
      locationCount: 15,
      sphereCount: 4,
      unreachableLocationCount: 0,
      uploadedByName: 'Alice',
    });
    const prisma = testApp.app.get(PrismaService);
    const grub = await prisma.seedLocation.findFirstOrThrow({ where: { locationName: 'Crossroads_(Grub)' } });
    expect(grub).toMatchObject({
      locationId: 3000000101n,
      itemName: 'Geo_Rock-Default',
      itemType: 'normal',
      sphere: 3,
    });
    const datapackage = await prisma.datapackage.findUniqueOrThrow({ where: { checksum: 'celestechecksum0001' } });
    expect(JSON.parse(datapackage.locationNames ?? '{}')).toMatchObject({ 'Old Site: Strawberry 2': 201 });
    const slotLock = await prisma.datapackage.findUniqueOrThrow({ where: { checksum: 'slotlockchecksum0001' } });
    expect(JSON.parse(slotLock.itemNames)).toMatchObject({ 'Unlock Alice': 1003 });
  });

  it('shows the seed data to admins and in the room detail', async () => {
    const seed = await request(server).get('/api/rooms/big-chill/seed').set('Cookie', ownerCookie).expect(200);
    expect(seed.body).toMatchObject({ seedName: '12345678901234567890' });
    const room = await request(server).get('/api/rooms/big-chill').expect(200);
    expect(room.body).toMatchObject({ hasSeed: true });
  });

  it('accepts only one upload for each room', async () => {
    const response = await upload(ownerCookie, multidataFixturePath('big-chill')).expect(409);
    expect(response.body).toMatchObject({ code: 'SEED_ALREADY_UPLOADED' });
    expect(await testApp.app.get(PrismaService).seedLocation.count()).toBe(15);
  });

  it('marks the locations that Archipelago reports as checked', async () => {
    const prisma = testApp.app.get(PrismaService);
    const checked = await prisma.seedLocation.findMany({ where: { checked: true }, orderBy: { locationName: 'asc' } });
    expect(checked.map((location) => location.locationName)).toEqual([
      'Free Item Alice 1',
      'Kakariko Well (Top)',
      "Link's House",
      'Sanctuary',
    ]);
    expect(checked.every((location) => location.checkedFirstSeenAt !== null)).toBe(true);
  });

  it('marks new checks in the next synchronization and sends a live message', async () => {
    const tracker = loadFixture('ap-tracker') as { player_checks_done: { player: number; locations: number[] }[] };
    tracker.player_checks_done[2]?.locations.push(20001);
    testApp.fixtureOverrides.set('ap-tracker', tracker);
    const publish = vi.spyOn(testApp.app.get(LiveGateway), 'publishLocationsChanged');
    const room = (await request(server).get('/api/rooms/big-chill').expect(200)).body as { id: number };
    await expect(testApp.app.get(SyncService).syncRoom(room.id, 'schedule')).resolves.toBe('success');
    const location = await testApp.app
      .get(PrismaService)
      .seedLocation.findFirstOrThrow({ where: { locationName: 'Mothwing_Cloak' } });
    expect(location.checked).toBe(true);
    expect(publish).toHaveBeenCalledWith({ slug: 'big-chill', lowestOpenSphere: 0, changedCount: 1 });
    testApp.fixtureOverrides.delete('ap-tracker');
    publish.mockRestore();
  });
});
