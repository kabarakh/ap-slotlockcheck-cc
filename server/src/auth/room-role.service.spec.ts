import type { PrismaService } from '../prisma/prisma.service.js';
import { RoomRoleService } from './room-role.service.js';

const user = { id: 3, discordId: '100', name: 'Bob', username: 'bob', avatar: null };

function serviceWith(admin: { isOwner: boolean; role: string } | null, slotCount: number): RoomRoleService {
  const prisma = {
    roomAdmin: { findUnique: vi.fn().mockResolvedValue(admin) },
    slot: { count: vi.fn().mockResolvedValue(slotCount) },
  } as unknown as PrismaService;
  return new RoomRoleService(prisma);
}

describe('RoomRoleService', () => {
  it('orders the roles visitor, player, helper and admin', () => {
    expect(RoomRoleService.satisfies('helper', 'player')).toBe(true);
    expect(RoomRoleService.satisfies('helper', 'helper')).toBe(true);
    expect(RoomRoleService.satisfies('helper', 'admin')).toBe(false);
    expect(RoomRoleService.satisfies('player', 'helper')).toBe(false);
    expect(RoomRoleService.satisfies('admin', 'helper')).toBe(true);
    expect(RoomRoleService.satisfies('visitor', 'player')).toBe(false);
  });

  it('gives the role of the room admin entry', async () => {
    await expect(serviceWith({ isOwner: false, role: 'helper' }, 0).getMembership(user, { id: 1 })).resolves.toEqual({
      role: 'helper',
      isOwner: false,
    });
    await expect(serviceWith({ isOwner: false, role: 'admin' }, 0).getMembership(user, { id: 1 })).resolves.toEqual({
      role: 'admin',
      isOwner: false,
    });
  });

  it('keeps the owner an admin', async () => {
    await expect(serviceWith({ isOwner: true, role: 'helper' }, 0).getMembership(user, { id: 1 })).resolves.toEqual({
      role: 'admin',
      isOwner: true,
    });
  });

  it('gives player or visitor without an admin entry', async () => {
    await expect(serviceWith(null, 2).getMembership(user, { id: 1 })).resolves.toEqual({
      role: 'player',
      isOwner: false,
    });
    await expect(serviceWith(null, 0).getMembership(user, { id: 1 })).resolves.toEqual({
      role: 'visitor',
      isOwner: false,
    });
    await expect(serviceWith(null, 2).getMembership(undefined, { id: 1 })).resolves.toEqual({
      role: 'visitor',
      isOwner: false,
    });
  });
});
