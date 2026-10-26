import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { slotRow } from '@/domain/__tests__/fixtures';
import { useAdminStore } from '../admin';
import { useAuthStore } from '../auth';
import { useCurrentRoomStore } from '../current-room';
import { useRoomOwnershipStore } from '../room-ownership';

describe('useRoomOwnershipStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().user = { id: 1, discordId: '1', name: 'Alice', username: 'alice', avatar: null };
    const room = useCurrentRoomStore();
    room.slots = [
      slotRow({ id: 1, discordUserId: '1', discordName: 'alice' }),
      slotRow({ id: 2, discordUserId: '2', discordName: 'bob' }),
      slotRow({ id: 3, discordUserId: '2', discordName: 'bob' }),
      slotRow({ id: 4, discordUserId: null }),
    ];
    useAdminStore().admins = [
      { userId: 1, discordId: '1', name: 'Alice', isOwner: true, role: 'admin' },
      { userId: 9, discordId: '9', name: 'Zed', isOwner: false, role: 'helper' },
    ];
  });

  it('offers the admins and the players except the own user as new owner', () => {
    expect(useRoomOwnershipStore().transferOptions).toEqual([
      { discordId: '2', name: 'bob' },
      { discordId: '9', name: 'Zed' },
    ]);
  });

  it('permits the deletion only with the exact title of the room', () => {
    const ownership = useRoomOwnershipStore();
    useCurrentRoomStore().room = { title: 'Big Chill' } as never;
    ownership.deleteTitle = 'big chill';
    expect(ownership.canDelete).toBe(false);
    ownership.deleteTitle = 'Big Chill';
    expect(ownership.canDelete).toBe(true);
  });
});
