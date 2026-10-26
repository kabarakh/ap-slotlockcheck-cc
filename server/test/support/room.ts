import request from 'supertest';
import type { App } from 'supertest/types.js';

export const TRACKER_ID = 'AbCdEfGhIjKlMnOpQrStUv';
export const OWNER = { discordId: '100000000000000001', name: 'Alice', username: 'alice_owner' };
export const PLAYER = { discordId: '100000000000000002', name: 'Bob', username: 'bob' };
export const CAROL = { discordId: '100000000000000003', name: 'Carol', username: 'carol' };
export const STRANGER = { discordId: '100000000000000055', name: 'Stranger', username: 'stranger' };

export type TestUser = typeof OWNER;

export async function login(server: App, user: TestUser): Promise<string[]> {
  const response = await request(server).post('/api/auth/test-login').send(user).expect(200);
  return response.get('Set-Cookie') ?? [];
}

export async function createRoom(server: App, ownerCookie: string[]): Promise<void> {
  await request(server)
    .post('/api/room-setup')
    .set('Cookie', ownerCookie)
    .send({ cheeseTrackerId: TRACKER_ID, slug: 'big-chill', title: 'Big Chill', slotLockPositions: [1, 6] })
    .expect(201);
}
