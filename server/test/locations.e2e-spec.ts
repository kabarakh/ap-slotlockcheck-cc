import request from 'supertest';
import type { App } from 'supertest/types.js';
import type {
  LocationAdminPageDto,
  SphereCleanupDto,
  LocationUserPageDto,
  SphereOverviewDto,
} from '../src/locations/dto/location.dto.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { multidataFixturePath } from './fixtures/fixtures.js';
import { CAROL, createRoom, login, OWNER, PLAYER, STRANGER } from './support/room.js';
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

  it('finds the unlock items with the receiver filter of the admin view', async () => {
    const prisma = testApp.app.get(PrismaService);
    const locker = await prisma.slot.findFirstOrThrow({ where: { name: 'Locker' } });
    const page = (await get(`/locations/admin?state=open&receiverSlotIds=${locker.id}`, ownerCookie).expect(200))
      .body as LocationAdminPageDto;
    expect(page.rows.map((row) => [row.finderName, row.itemName])).toEqual([
      ['Alice', 'Nothing'],
      ['Bob', 'Unlock Alice'],
      ['Carol', 'Unlock Bonus Slot 1'],
      ['Davey (Dave)', 'Unlock Alice'],
    ]);
    const lockerAsFinder = (
      await get(`/locations/admin?state=open&slots=selected&slotIds=${locker.id}`, ownerCookie).expect(200)
    ).body as LocationAdminPageDto;
    expect(lockerAsFinder.rows.map((row) => row.locationName)).toEqual(['Free Item Bob 1']);
    const userPage = (await get(`/locations?state=open&receiverSlotIds=${locker.id}`, playerCookie).expect(200))
      .body as LocationUserPageDto;
    expect(userPage.total).toBe(2);
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

  const locationId = async (locationName: string): Promise<number> =>
    (await testApp.app.get(PrismaService).seedLocation.findFirstOrThrow({ where: { locationName } })).id;

  const mark = (id: number, cookie: string[] = []) =>
    request(server).put(`/api/rooms/big-chill/locations/${id}/filler-mark`).set('Cookie', cookie);

  it('lets players mark only the open locations of their own slots', async () => {
    const carolCookie = await login(server, CAROL);
    await mark(await locationId('Old Site: Strawberry 2'), carolCookie).expect(204);
    const removal = await request(server)
      .delete(`/api/rooms/big-chill/locations/${await locationId('Old Site: Strawberry 2')}/filler-mark`)
      .set('Cookie', carolCookie)
      .expect(403);
    expect(removal.body).toMatchObject({ code: 'FILLER_MARK_NOT_PERMITTED' });
    const foreign = await mark(await locationId('Salubra_(Requires_Charms)'), carolCookie).expect(403);
    expect(foreign.body).toMatchObject({ code: 'FILLER_MARK_NOT_PERMITTED' });
    await mark(await locationId('Salubra_(Requires_Charms)')).expect(403);
    const checked = await mark(await locationId("Link's House"), ownerCookie).expect(400);
    expect(checked.body).toMatchObject({ code: 'LOCATION_ALREADY_CHECKED' });
    expect((await mark(999999, ownerCookie).expect(404)).body).toMatchObject({ code: 'LOCATION_NOT_FOUND' });
  });

  it('lists the marked locations without sphere limit and shows who marked them', async () => {
    const page = (await get('/locations?state=filler', playerCookie).expect(200)).body as LocationUserPageDto;
    expect(page.rows.map((row) => [row.locationName, row.sphere, row.fillerMarked])).toEqual([
      ['Old Site: Strawberry 2', 2, true],
    ]);
    const adminPage = (await get('/locations/admin?state=filler', ownerCookie).expect(200))
      .body as LocationAdminPageDto;
    expect(adminPage.rows[0]).toMatchObject({ fillerMarkedByName: 'Carol' });
    expect(adminPage.rows[0]?.fillerMarkedAt).toEqual(expect.any(String));
  });

  it('makes a helper who sees the admin view but cannot change the room', async () => {
    const admins = await request(server)
      .post('/api/rooms/big-chill/admins')
      .set('Cookie', ownerCookie)
      .send({ discordId: PLAYER.discordId, role: 'helper' })
      .expect(201);
    expect(admins.body).toContainEqual(expect.objectContaining({ discordId: PLAYER.discordId, role: 'helper' }));
    expect(admins.body).toContainEqual(expect.objectContaining({ discordId: OWNER.discordId, role: 'admin' }));
    await get('/me', playerCookie).expect(200, { role: 'helper', isOwner: false });
    await get('/locations/admin?state=open', playerCookie).expect(200);
    await get('/seed', playerCookie).expect(200);
    await request(server).patch('/api/rooms/big-chill/settings').set('Cookie', playerCookie).send({}).expect(403);
    await request(server).get('/api/rooms/big-chill/warnings').set('Cookie', playerCookie).expect(403);
    await request(server)
      .delete(`/api/rooms/big-chill/locations/${await locationId('Old Site: Strawberry 2')}/filler-mark`)
      .set('Cookie', playerCookie)
      .expect(204);
    const page = (await get('/locations?state=filler', playerCookie).expect(200)).body as LocationUserPageDto;
    expect(page.total).toBe(0);
  });

  it('does not change the role of an existing admin or helper', async () => {
    for (const discordId of [OWNER.discordId, PLAYER.discordId]) {
      const response = await request(server)
        .post('/api/rooms/big-chill/admins')
        .set('Cookie', ownerCookie)
        .send({ discordId, role: 'admin' })
        .expect(409);
      expect(response.body).toMatchObject({ code: 'ALREADY_ADMIN' });
    }
    await get('/me', playerCookie).expect(200, { role: 'helper', isOwner: false });
  });

  it('makes a helper with an invitation link', async () => {
    const invitation = await request(server)
      .post('/api/rooms/big-chill/invitations')
      .set('Cookie', ownerCookie)
      .send({ role: 'helper' })
      .expect(201);
    expect(invitation.body).toMatchObject({ role: 'helper' });
    const token = new URL((invitation.body as { url: string }).url).pathname.split('/').pop() ?? '';
    const strangerCookie = await login(server, STRANGER);
    await request(server).post(`/api/invitations/${token}/accept`).set('Cookie', strangerCookie).expect(200);
    await get('/me', strangerCookie).expect(200, { role: 'helper', isOwner: false });
  });

  it('gives the helpers the open items of each slot for the sphere clean-up', async () => {
    await get('/sphere-cleanup?fromSphere=0&toSphere=3').expect(403);
    const cleanup = (await get('/sphere-cleanup?fromSphere=3&toSphere=0', playerCookie).expect(200))
      .body as SphereCleanupDto;
    expect(cleanup.fromSphere).toBe(0);
    expect(cleanup.toSphere).toBe(3);
    expect(
      cleanup.entries.map((entry) => [entry.slotName, entry.progression, entry.useful, entry.normal, entry.trap]),
    ).toEqual([
      ['Locker', 1, 0, 0, 0],
      ['Bob', 2, 0, 0, 0],
      ['Alice', 1, 0, 1, 0],
      ['Locker2', 0, 1, 0, 0],
      ['Carol', 0, 1, 1, 0],
      ['Davey (Dave)', 1, 0, 0, 1],
    ]);
    expect(cleanup.entries.map((entry) => entry.lowestSphere)).toEqual([0, 0, 1, 1, 2, 2]);
    expect(cleanup.entries[1]).toMatchObject({ discordUserId: PLAYER.discordId });
    const progression = (
      await get('/sphere-cleanup?fromSphere=0&toSphere=3&slots=progression&excludeGoaled=true', playerCookie).expect(
        200,
      )
    ).body as SphereCleanupDto;
    expect(progression.entries.map((entry) => entry.slotName)).toEqual(['Locker', 'Bob', 'Alice', 'Davey (Dave)']);
    await get('/sphere-cleanup?fromSphere=0', playerCookie).expect(400);
  });
});
