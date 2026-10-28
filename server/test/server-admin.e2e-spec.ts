import request from 'supertest';
import type { App } from 'supertest/types.js';

import type { AdminConnection, AdminConnectionTarget, ServerReply } from '../src/archipelago-admin/admin-connection.js';
import { ADMIN_CONNECTION_FACTORY } from '../src/archipelago-admin/admin-connection.js';
import { ADMIN_TIMING, type AdminTiming } from '../src/archipelago-admin/admin-jobs.service.js';
import type { ServerAdminStatusDto, ServerJobDto } from '../src/archipelago-admin/dto/archipelago-admin.dto.js';
import { LiveGateway } from '../src/live/live.gateway.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { multidataFixturePath } from './fixtures/fixtures.js';
import { createRoom, login, OWNER, PLAYER } from './support/room.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const TIMING: AdminTiming = {
  pauseMilliseconds: 0,
  replyWaitMilliseconds: 0,
  loginTimeoutMilliseconds: 200,
  pollMilliseconds: 1,
  reconnectMilliseconds: 1,
  reconnectTimeoutMilliseconds: 20,
  connectTimeoutMilliseconds: 50,
};

const said: string[] = [];
const targets: AdminConnectionTarget[] = [];

class RecordingConnection implements AdminConnection {
  private replies: ServerReply[] = [];

  open(target: AdminConnectionTarget): Promise<void> {
    targets.push(target);
    return Promise.resolve();
  }

  say(line: string): Promise<void> {
    said.push(line);
    if (line.startsWith('!admin login ')) {
      const ok = line === '!admin login admin-secret';
      this.replies.push({ kind: 'CommandResult', text: ok ? 'Login successful.' : 'Password incorrect.' });
    }
    return Promise.resolve();
  }

  takeReplies(): ServerReply[] {
    const taken = this.replies;
    this.replies = [];
    return taken;
  }

  close(): void {}
}

describe('server connection (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let playerCookie: string[];

  const path = (suffix: string) => `/api/rooms/big-chill/server-admin${suffix}`;

  const waitForJob = async (): Promise<ServerJobDto> => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const job = (await request(server).get(path('/job')).set('Cookie', ownerCookie).expect(200)).body as ServerJobDto;
      if (job.state !== 'running') {
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('The job did not finish');
  };

  beforeAll(async () => {
    testApp = await createTestApp([
      [ADMIN_CONNECTION_FACTORY, () => new RecordingConnection()],
      [ADMIN_TIMING, TIMING],
    ]);
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

  beforeEach(() => {
    said.length = 0;
    targets.length = 0;
  });

  it('is only for admins', async () => {
    await request(server).get(path('')).set('Cookie', playerCookie).expect(403);
    await request(server).put(path('/login')).set('Cookie', playerCookie).send({ serverPassword: 'x' }).expect(403);
  });

  it('needs a login before a command', async () => {
    const status = (await request(server).get(path('')).set('Cookie', ownerCookie).expect(200))
      .body as ServerAdminStatusDto;
    expect(status).toEqual({ loggedIn: false, slotId: null, job: null });
    const response = await request(server).post(path('/release')).set('Cookie', ownerCookie).send({ slotId: 1 });
    expect(response.status).toBe(428);
    expect(response.body).toMatchObject({ code: 'SERVER_LOGIN_REQUIRED' });
  });

  it('needs the selection of the SlotLock slot when the room has more than one', async () => {
    const response = await request(server)
      .put(path('/login'))
      .set('Cookie', ownerCookie)
      .send({ serverPassword: 'admin-secret' })
      .expect(400);
    expect(response.body).toMatchObject({ code: 'CONNECTION_SLOT_REQUIRED' });
  });

  it('rejects a wrong password and keeps nothing', async () => {
    const locker = await testApp.app.get(PrismaService).slot.findFirstOrThrow({ where: { name: 'Locker' } });
    const response = await request(server)
      .put(path('/login'))
      .set('Cookie', ownerCookie)
      .send({ slotId: locker.id, serverPassword: 'wrong' })
      .expect(400);
    expect(response.body).toMatchObject({ code: 'SERVER_LOGIN_FAILED' });
    expect(JSON.stringify(response.body)).not.toContain('wrong');
    const status = (await request(server).get(path('')).set('Cookie', ownerCookie).expect(200))
      .body as ServerAdminStatusDto;
    expect(status.loggedIn).toBe(false);
  });

  it('logs in as the SlotLock slot on the current port of the room', async () => {
    const locker = await testApp.app.get(PrismaService).slot.findFirstOrThrow({ where: { name: 'Locker' } });
    const status = (
      await request(server)
        .put(path('/login'))
        .set('Cookie', ownerCookie)
        .send({ slotId: locker.id, serverPassword: 'admin-secret', roomPassword: 'room-secret' })
        .expect(200)
    ).body as ServerAdminStatusDto;
    expect(status).toMatchObject({ loggedIn: true, slotId: locker.id });
    expect(targets).toEqual([
      { address: 'wss://archipelago.gg:38281', slotName: 'Locker', roomPassword: 'room-secret' },
    ]);
    expect(said).toEqual(['!admin login admin-secret', '!admin logout']);
  });

  it('releases the open filler locations of the selected spheres', async () => {
    const preview = await request(server)
      .get(path('/release-spheres/preview?fromSphere=1&toSphere=3&mode=filler'))
      .set('Cookie', ownerCookie)
      .expect(200);
    expect(preview.body).toEqual({ locationCount: 6, progressionCount: 0 });
    const publish = vi.spyOn(testApp.app.get(LiveGateway), 'publishLocationsChanged');
    await request(server)
      .post(path('/release-spheres'))
      .set('Cookie', ownerCookie)
      .send({ fromSphere: 1, toSphere: 3, mode: 'filler' })
      .expect(202);
    const job = await waitForJob();
    expect(job).toMatchObject({ command: 'release_spheres', state: 'done', total: 6, done: 6, errors: [] });
    expect(said).toEqual([
      '!admin login admin-secret',
      '!admin /send_location "Alice" "Aginah\'s Cave"',
      '!admin /send_location "Locker2" "Free Item Carol 1"',
      '!admin /send_location "Carol" "Forsaken City: Strawberry 1"',
      '!admin /send_location "Carol" "Old Site: Strawberry 2"',
      '!admin /send_location "Bob" "Crossroads_(Grub)"',
      '!admin /send_location "Dave" "Logistics (2)"',
      '!admin logout',
    ]);
    await vi.waitFor(() => expect(publish).toHaveBeenCalled());
    publish.mockRestore();
  });

  it('sends single locations, items, release and collect with the original slot names', async () => {
    const prisma = testApp.app.get(PrismaService);
    const dave = await prisma.slot.findFirstOrThrow({ where: { name: 'Davey (Dave)' } });
    const location = await prisma.seedLocation.findFirstOrThrow({ where: { locationName: 'Automate (1)' } });
    await request(server)
      .post(path('/send-location'))
      .set('Cookie', ownerCookie)
      .send({ locationIds: [location.id] })
      .expect(202);
    await waitForJob();
    await request(server)
      .post(path('/send-item'))
      .set('Cookie', ownerCookie)
      .send({ slotId: dave.id, itemName: 'Evolution Trap', amount: 2 })
      .expect(202);
    await waitForJob();
    await request(server).post(path('/release')).set('Cookie', ownerCookie).send({ slotId: dave.id }).expect(202);
    await waitForJob();
    await request(server).post(path('/collect')).set('Cookie', ownerCookie).send({ slotId: dave.id }).expect(202);
    await waitForJob();
    expect(said.filter((line) => !line.startsWith('!admin log'))).toEqual([
      '!admin /send_location "Dave" "Automate (1)"',
      '!admin /send_multiple 2 "Dave" "Evolution Trap"',
      '!admin /release Dave',
      '!admin /collect Dave',
    ]);
    await request(server)
      .post(path('/send-location'))
      .set('Cookie', ownerCookie)
      .send({ locationIds: [999999] })
      .expect(404);
  });

  it('gives the item names of the game of a slot', async () => {
    const dave = await testApp.app.get(PrismaService).slot.findFirstOrThrow({ where: { name: 'Davey (Dave)' } });
    const response = await request(server)
      .get(path(`/items?slotId=${dave.id}`))
      .set('Cookie', ownerCookie)
      .expect(200);
    expect(response.body).toEqual({ itemNames: ['Evolution Trap', 'progressive-science-pack'] });
  });

  it('removes the passwords with the logout', async () => {
    const status = (await request(server).delete(path('/login')).set('Cookie', ownerCookie).expect(200))
      .body as ServerAdminStatusDto;
    expect(status.loggedIn).toBe(false);
    await request(server).post(path('/collect')).set('Cookie', ownerCookie).send({ slotId: 1 }).expect(428);
  });
});
