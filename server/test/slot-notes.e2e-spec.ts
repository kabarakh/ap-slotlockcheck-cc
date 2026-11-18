import request from 'supertest';
import type { App } from 'supertest/types.js';

import type { InternalNoteDto, StaffNoteDto } from '../src/notes/dto/slot-note.dto.js';
import type { SlotRowDto } from '../src/rooms/dto/slot-row.dto.js';
import { createRoom, login, OWNER, PLAYER, STRANGER } from './support/room.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('slot notes (integration)', () => {
  let testApp: TestApp;
  let server: App;
  let ownerCookie: string[];
  let helperCookie: string[];
  let strangerCookie: string[];
  let slotId: number;

  const roster = async (): Promise<SlotRowDto[]> =>
    (await request(server).get('/api/rooms/big-chill/roster').expect(200)).body as SlotRowDto[];
  const notePath = (kind: string) => `/api/rooms/big-chill/slots/${slotId}/notes/${kind}`;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as App;
    ownerCookie = await login(server, OWNER);
    helperCookie = await login(server, PLAYER);
    strangerCookie = await login(server, STRANGER);
    await createRoom(server, ownerCookie);
    await request(server)
      .post('/api/rooms/big-chill/admins')
      .set('Cookie', ownerCookie)
      .send({ discordId: PLAYER.discordId, role: 'helper' })
      .expect(201);
    slotId = (await roster()).find((slot) => !slot.isSlotLock)?.id ?? 0;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('starts without staff notes', async () => {
    expect((await roster()).every((slot) => slot.staffNote === null)).toBe(true);
    const internal = (
      await request(server).get('/api/rooms/big-chill/notes/internal').set('Cookie', ownerCookie).expect(200)
    ).body as InternalNoteDto[];
    expect(internal).toEqual([]);
  });

  it('shows the public note to everybody in the roster', async () => {
    const saved = (
      await request(server)
        .put(notePath('public'))
        .set('Cookie', helperCookie)
        .send({ text: 'Away until Friday' })
        .expect(200)
    ).body as StaffNoteDto;
    expect(saved).toMatchObject({ text: 'Away until Friday', updatedByName: PLAYER.name });
    const slot = (await roster()).find((row) => row.id === slotId);
    expect(slot?.staffNote).toMatchObject({ text: 'Away until Friday', updatedByName: PLAYER.name });
  });

  it('keeps the internal note out of the roster and gives it only to admins and helpers', async () => {
    await request(server)
      .put(notePath('internal'))
      .set('Cookie', ownerCookie)
      .send({ text: 'Second warning soon' })
      .expect(200);
    expect(JSON.stringify(await roster())).not.toContain('Second warning soon');
    await request(server).get('/api/rooms/big-chill/notes/internal').expect(403);
    await request(server).get('/api/rooms/big-chill/notes/internal').set('Cookie', strangerCookie).expect(403);
    const internal = (
      await request(server).get('/api/rooms/big-chill/notes/internal').set('Cookie', helperCookie).expect(200)
    ).body as InternalNoteDto[];
    expect(internal).toEqual([
      expect.objectContaining({ slotId, text: 'Second warning soon', updatedByName: OWNER.name }),
    ]);
  });

  it('lets only admins and helpers write notes', async () => {
    await request(server).put(notePath('public')).set('Cookie', strangerCookie).send({ text: 'x' }).expect(403);
    await request(server).put(notePath('internal')).send({ text: 'x' }).expect(403);
  });

  it('keeps an empty note with its last change', async () => {
    await request(server).put(notePath('public')).set('Cookie', ownerCookie).send({ text: '' }).expect(200);
    expect((await roster()).find((row) => row.id === slotId)?.staffNote).toMatchObject({
      text: '',
      updatedByName: OWNER.name,
    });
  });

  it('refuses unknown kinds, other slots and too long texts', async () => {
    await request(server).put(notePath('player')).set('Cookie', ownerCookie).send({ text: 'x' }).expect(400);
    await request(server)
      .put('/api/rooms/big-chill/slots/999999/notes/public')
      .set('Cookie', ownerCookie)
      .send({ text: 'x' })
      .expect(400);
    await request(server)
      .put(notePath('public'))
      .set('Cookie', ownerCookie)
      .send({ text: 'x'.repeat(10_001) })
      .expect(400);
  });

  it('makes the notes read-only in an archived room', async () => {
    await request(server).post('/api/rooms/big-chill/archive').set('Cookie', ownerCookie).expect(200);
    await request(server).put(notePath('public')).set('Cookie', ownerCookie).send({ text: 'Late' }).expect(409);
    await request(server).put(notePath('internal')).set('Cookie', helperCookie).send({ text: 'Late' }).expect(409);
    await request(server).get('/api/rooms/big-chill/notes/internal').set('Cookie', helperCookie).expect(200);
  });
});
