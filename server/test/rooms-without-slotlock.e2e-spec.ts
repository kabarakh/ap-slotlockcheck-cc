import request from 'supertest';
import type { App } from 'supertest/types.js';

import type { AdminConnection, ServerReply } from '../src/archipelago-admin/admin-connection.js';
import { ADMIN_CONNECTION_FACTORY } from '../src/archipelago-admin/admin-connection.js';
import { ADMIN_TIMING, type AdminTiming } from '../src/archipelago-admin/admin-jobs.service.js';
import type { ServerAdminStatusDto } from '../src/archipelago-admin/dto/archipelago-admin.dto.js';
import type { RoomPaceDto } from '../src/pace/dto/pace.dto.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import type { RoomDetailDto } from '../src/rooms/dto/room.dto.js';
import type { SlotRowDto } from '../src/rooms/dto/slot-row.dto.js';
import { createRoom, login, OWNER } from './support/room.js';
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

const slotNames: string[] = [];

class LoginConnection implements AdminConnection {
  private replies: ServerReply[] = [];

  open(target: { slotName: string }): Promise<void> {
    slotNames.push(target.slotName);
    return Promise.resolve();
  }

  say(line: string): Promise<void> {
    if (line.startsWith('!admin login ')) {
      this.replies.push({ kind: 'CommandResult', text: 'Login successful.' });
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

describe('rooms without SlotLock (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];

  const roster = async (): Promise<Record<string, SlotRowDto>> => {
    const response = await request(server).get('/api/rooms/big-chill/roster').expect(200);
    return Object.fromEntries((response.body as SlotRowDto[]).map((row) => [row.name, row]));
  };

  const loginPath = '/api/rooms/big-chill/server-admin/login';

  beforeAll(async () => {
    testApp = await createTestApp([
      [ADMIN_CONNECTION_FACTORY, () => new LoginConnection()],
      [ADMIN_TIMING, TIMING],
    ]);
    server = testApp.app.getHttpServer() as App;
    ownerCookie = await login(server, OWNER);
    await createRoom(server, ownerCookie, []);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('creates a room without a selected SlotLock slot', async () => {
    const room = (await request(server).get('/api/rooms/big-chill').expect(200)).body as RoomDetailDto;
    expect(room).toMatchObject({ hasSlotLock: false, lockedSlotCount: 0, unlockedSlotCount: 0, unknownSlotNames: [] });
    const list = (await request(server).get('/api/rooms').set('Cookie', ownerCookie).expect(200)).body as {
      slug: string;
      hasSlotLock: boolean;
    }[];
    expect(list.find((entry) => entry.slug === 'big-chill')?.hasSlotLock).toBe(false);
  });

  it('makes each playable slot a start slot and detects no locks', async () => {
    const rows = await roster();
    for (const name of ['Alice', 'Bob', 'Carol', 'Davey (Dave)']) {
      expect(rows[name]).toMatchObject({ lockStatus: 'start_slot', locks: [], isSelectedSlotLock: false });
    }
    expect(rows['Locker']?.lockStatus).toBe('not_locked');
    const prisma = testApp.app.get(PrismaService);
    expect(await prisma.lockAssignment.count()).toBe(0);
    expect(await prisma.unlockItem.count()).toBe(0);
  });

  it('saves the settings without SlotLock slots', async () => {
    await request(server)
      .patch('/api/rooms/big-chill/settings')
      .set('Cookie', ownerCookie)
      .send({ title: 'Big Chill Async', yellowLimitHours: 12, redLimitHours: 36 })
      .expect(204);
    const room = (await request(server).get('/api/rooms/big-chill').expect(200)).body as RoomDetailDto;
    expect(room).toMatchObject({ title: 'Big Chill Async', hasSlotLock: false });
  });

  it('gives pace values from the start of the checks history', async () => {
    const body = (await request(server).get('/api/rooms/big-chill/pace').set('Cookie', ownerCookie).expect(200))
      .body as RoomPaceDto;
    expect(body.slots.map((slot) => slot.name)).toEqual(['Alice', 'Bob', 'Carol', 'Davey (Dave)']);
    const withRange = body.slots.filter((slot) => slot.hasRange);
    expect(withRange.length).toBeGreaterThan(0);
    for (const slot of withRange) {
      expect(slot.startKind).toBe('history_start');
    }
  });

  it('connects to the server as a playable slot', async () => {
    const missing = await request(server)
      .put(loginPath)
      .set('Cookie', ownerCookie)
      .send({ serverPassword: 'admin-secret' })
      .expect(400);
    expect(missing.body).toMatchObject({ code: 'CONNECTION_SLOT_REQUIRED' });
    const rows = await roster();
    const locker = await request(server)
      .put(loginPath)
      .set('Cookie', ownerCookie)
      .send({ slotId: rows['Locker']?.id, serverPassword: 'admin-secret' })
      .expect(400);
    expect(locker.body).toMatchObject({ code: 'CONNECTION_SLOT_REQUIRED' });
    const status = (
      await request(server)
        .put(loginPath)
        .set('Cookie', ownerCookie)
        .send({ slotId: rows['Bob']?.id, serverPassword: 'admin-secret' })
        .expect(200)
    ).body as ServerAdminStatusDto;
    expect(status).toMatchObject({ loggedIn: true, slotId: rows['Bob']?.id });
    expect(slotNames).toEqual(['Bob']);
  });
});
