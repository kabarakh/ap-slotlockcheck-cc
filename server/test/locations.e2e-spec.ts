import request from 'supertest';
import type { App } from 'supertest/types.js';
import type {
  LocationAdminPageDto,
  LocationUserPageDto,
  SphereOverviewDto,
} from '../src/locations/dto/location.dto.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { multidataFixturePath } from './fixtures/fixtures.js';
import { createRoom, login, OWNER, PLAYER } from './support/room.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('spheres and locations (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let playerCookie: string[];

  const get = (path: string, cookie: string[] = []) =>
    request(server).get(`/api/rooms/big-chill${path}`).set('Cookie', cookie);

  const settings = (body: Record<string, unknown>) =>
    request(server).patch('/api/rooms/big-chill/settings').set('Cookie', ownerCookie).send(body).expect(204);

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as App;
    ownerCookie = await login(server, OWNER);
    playerCookie = await login(server, PLAYER);
    await createRoom(server, ownerCookie);
    await request(server)
      .post('/api/rooms/big-chill/seed')
      .set('Cookie', ownerCookie)
      .attach('file', multidataFixturePath('big-chill'))
      .expect(201);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('hides the locations from visitors by default', async () => {
    expect((await get('/spheres').expect(403)).body).toMatchObject({ code: 'LOCATIONS_NOT_PUBLIC' });
    await get('/locations?state=open').expect(403);
  });

  it('shows the players only the spheres up to the limit and no item types', async () => {
    const overview = (await get('/spheres', playerCookie).expect(200)).body as SphereOverviewDto;
    expect(overview).toEqual({
      lowestOpenSphere: 0,
      visibleMaxSphere: 0,
      sphereCount: 4,
      spheres: [{ sphere: 0, open: 2, found: 3, total: 5 }],
      itemTypes: null,
    });
  });

  it('shows the admins all spheres with the item types', async () => {
    const overview = (await get('/spheres', ownerCookie).expect(200)).body as SphereOverviewDto;
    expect(overview.visibleMaxSphere).toBe(4);
    expect(overview.spheres.map((sphere) => sphere.sphere)).toEqual([0, 1, 2, 3]);
    expect(overview.itemTypes?.[2]).toEqual({ sphere: 2, progression: 2, useful: 1, normal: 1, trap: 0 });
  });

  it('excludes slots with reached goal on request', async () => {
    const overview = (await get('/spheres?excludeGoaled=true', ownerCookie).expect(200)).body as SphereOverviewDto;
    expect(overview.spheres[2]).toEqual({ sphere: 2, open: 2, found: 0, total: 2 });
    expect(overview.itemTypes?.[2]).toEqual({ sphere: 2, progression: 2, useful: 0, normal: 0, trap: 0 });
  });

  it('gives the players the open locations up to the limit without items', async () => {
    const page = (await get('/locations?state=open', playerCookie).expect(200)).body as LocationUserPageDto;
    expect(page.total).toBe(2);
    expect(page.rows.map((row) => [row.sphere, row.finderName, row.locationName])).toEqual([
      [0, 'Locker', 'Free Item Bob 1'],
      [0, 'Bob', 'Salubra_(Requires_Charms)'],
    ]);
    expect(Object.keys(page.rows[0] ?? {}).sort()).toEqual([
      'canMarkFiller',
      'discordName',
      'fillerMarked',
      'finderName',
      'finderSlotId',
      'game',
      'id',
      'locationName',
      'sphere',
    ]);
    expect(page.rows.every((row) => !row.canMarkFiller)).toBe(true);
  });

  it('gives the admin view only to helpers and admins', async () => {
    await get('/locations/admin?state=open', playerCookie).expect(403);
    const page = (await get('/locations/admin?state=open&itemTypes=trap', ownerCookie).expect(200))
      .body as LocationAdminPageDto;
    expect(page.rows).toEqual([
      expect.objectContaining({
        locationName: 'Logistics (2)',
        receiverName: 'Dave',
        itemName: 'Evolution Trap',
        itemType: 'trap',
        canMarkFiller: true,
        fillerMarkedByName: null,
      }),
    ]);
  });

  it('pages, sorts and filters the locations', async () => {
    const page = (
      await get('/locations/admin?state=open&sort=location&order=desc&offset=1&limit=2', ownerCookie).expect(200)
    ).body as LocationAdminPageDto;
    expect(page.total).toBe(11);
    expect(page.rows.map((row) => row.locationName)).toEqual(['Old Site: Strawberry 2', 'Mothwing_Cloak']);
    const slots = await testApp.app
      .get(PrismaService)
      .slot.findMany({ where: { name: { in: ['Bob', 'Davey (Dave)'] } } });
    const selected = slots.map((slot) => `slotIds=${slot.id}`).join('&');
    const filtered = (
      await get(`/locations/admin?state=open&slots=selected&${selected}&fromSphere=3`, ownerCookie).expect(200)
    ).body as LocationAdminPageDto;
    expect(filtered.rows.map((row) => row.locationName)).toEqual(['Crossroads_(Grub)', 'Logistics (2)']);
    await get('/locations?state=open&limit=500', ownerCookie).expect(400);
    await get('/locations?state=closed', ownerCookie).expect(400);
  });

  it('shows the own slots with "mine"', async () => {
    await settings({ sphereOffset: 3 });
    const page = (await get('/locations?state=open&slots=mine', playerCookie).expect(200)).body as LocationUserPageDto;
    expect(page.rows.map((row) => row.locationName)).toEqual([
      'Salubra_(Requires_Charms)',
      'Mothwing_Cloak',
      'Crossroads_(Grub)',
    ]);
  });

  it('has no sphere limit for found locations', async () => {
    await settings({ sphereOffset: 0 });
    await testApp.app
      .get(PrismaService)
      .seedLocation.updateMany({ where: { locationName: 'Crossroads_(Grub)' }, data: { checked: true } });
    const page = (await get('/locations?state=found', playerCookie).expect(200)).body as LocationUserPageDto;
    expect(page.rows.map((row) => row.sphere)).toEqual([0, 0, 0, 1, 3]);
  });

  it('lets visitors see the locations with the room setting and lets players mark own locations', async () => {
    await settings({ visitorsSeeLocations: true, playersMarkFiller: true });
    const visitorPage = (await get('/locations?state=open').expect(200)).body as LocationUserPageDto;
    expect(visitorPage.rows.every((row) => !row.canMarkFiller)).toBe(true);
    await get('/locations?state=open&slots=mine').expect(403);
    const playerPage = (await get('/locations?state=open', playerCookie).expect(200)).body as LocationUserPageDto;
    expect(playerPage.rows.map((row) => [row.finderName, row.canMarkFiller])).toEqual([
      ['Locker', false],
      ['Bob', true],
    ]);
    const room = await request(server).get('/api/rooms/big-chill').expect(200);
    expect(room.body).toMatchObject({ sphereOffset: 0, visitorsSeeLocations: true, playersMarkFiller: true });
  });
});
