import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { LocationUserRow, RoomDetail, SphereOverview } from '@/api/types';
import { slotRow } from '@/domain/__tests__/fixtures';
import { useAuthStore } from '../auth';
import { useCurrentRoomStore } from '../current-room';
import { useLocationsStore } from '../locations';
import { useSphereOverviewStore } from '../sphere-overview';

const apiGet = vi.hoisted(() => vi.fn<(path: string, options?: unknown) => Promise<unknown>>());

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api: { GET: apiGet },
}));

const room = (overrides: Partial<RoomDetail>): RoomDetail => ({
  id: 1,
  slug: 'big-chill',
  title: 'Big Chill',
  slotCount: 2,
  lockedSlotCount: 1,
  unlockedSlotCount: 0,
  unlockedPercentage: 0,
  syncStatus: { lastSyncAt: null, lastSuccessfulSyncAt: null, lastSyncError: null, running: false },
  cheeseTrackerId: 'AbCdEfGhIjKlMnOpQrStUv',
  cheeseTrackerUrl: 'https://cheese.test/tracker/AbCdEfGhIjKlMnOpQrStUv',
  archipelagoTrackerUrl: 'https://archipelago.gg/tracker/x',
  yellowLimitHours: 24,
  redLimitHours: 48,
  limitsOverridden: false,
  unknownSlotNames: [],
  manualSyncCooldownSeconds: 60,
  hasSeed: true,
  sphereOffset: 0,
  visitorsSeeLocations: false,
  playersMarkFiller: false,
  ...overrides,
});

const overview: SphereOverview = {
  lowestOpenSphere: 3,
  visibleMaxSphere: 5,
  sphereCount: 40,
  spheres: [],
  itemTypes: null,
};

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });

describe('useLocationsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiGet.mockReset();
    apiGet.mockImplementation((path: string) =>
      ok(path.endsWith('/spheres') ? overview : { total: 1, rows: [{ id: 9 }] }),
    );
    const current = useCurrentRoomStore();
    current.slug = 'big-chill';
    current.room = room({});
  });

  it('opens the user view for players even if the admin view is requested', async () => {
    useCurrentRoomStore().membership = { role: 'player', isOwner: false };
    const locations = useLocationsStore();
    await locations.enter('open', 'admin');
    expect(locations.view).toBe('user');
    expect(apiGet).toHaveBeenLastCalledWith(
      '/api/rooms/{slug}/locations',
      expect.objectContaining({
        params: expect.objectContaining({ query: expect.objectContaining({ state: 'open' }) }),
      }),
    );
    expect(locations.rows).toEqual([{ id: 9 }]);
    expect(locations.total).toBe(1);
  });

  it('opens the admin view for helpers', async () => {
    useCurrentRoomStore().membership = { role: 'helper', isOwner: false };
    const locations = useLocationsStore();
    await locations.enter('found', 'admin');
    expect(locations.view).toBe('admin');
    expect(apiGet).toHaveBeenLastCalledWith('/api/rooms/{slug}/locations/admin', expect.anything());
  });

  it('limits the sphere range of open locations in the user view', async () => {
    useCurrentRoomStore().membership = { role: 'player', isOwner: false };
    const locations = useLocationsStore();
    await locations.enter('open', 'user');
    expect(locations.sphereBounds).toEqual([0, 5]);
    await locations.enter('found', 'user');
    expect(locations.sphereBounds).toEqual([0, 40]);
  });

  it('sends the filters and the switch of the sphere overview', async () => {
    useCurrentRoomStore().membership = { role: 'admin', isOwner: true };
    const locations = useLocationsStore();
    useSphereOverviewStore().excludeGoaled = true;
    locations.filters = {
      slots: 'selected',
      slotIds: [4],
      receiverSlotIds: [1],
      itemTypes: ['trap'],
      sphereRange: [2, 6],
    };
    await locations.enter('open', 'admin');
    await locations.setSort('item', 'desc');
    expect(apiGet).toHaveBeenLastCalledWith('/api/rooms/{slug}/locations/admin', {
      params: {
        path: { slug: 'big-chill' },
        query: {
          state: 'open',
          slots: 'selected',
          slotIds: [4],
          receiverSlotIds: [1],
          itemTypes: ['trap'],
          fromSphere: 2,
          toSphere: 6,
          excludeGoaled: true,
          sort: 'item',
          order: 'desc',
          offset: 0,
          limit: 50,
        },
      },
    });
  });

  it('does not request the locations after leaving the page', async () => {
    useCurrentRoomStore().membership = { role: 'player', isOwner: false };
    const locations = useLocationsStore();
    await locations.enter('open', 'user');
    locations.leave();
    apiGet.mockClear();
    await locations.refresh();
    expect(apiGet).not.toHaveBeenCalled();
    expect(locations.rows).toEqual([]);
  });
});

describe('canUnmarkFiller', () => {
  const row = (overrides: Partial<LocationUserRow>): LocationUserRow => ({
    id: 1,
    sphere: 0,
    finderSlotId: 7,
    finderName: 'Bob',
    discordName: 'bob',
    game: 'Hollow Knight',
    locationName: 'Mothwing_Cloak',
    fillerMarked: true,
    canMarkFiller: false,
    ...overrides,
  });

  beforeEach(() => {
    setActivePinia(createPinia());
    const current = useCurrentRoomStore();
    current.room = room({ playersMarkFiller: true });
    current.slots = [slotRow({ id: 7, discordUserId: '2' }), slotRow({ id: 8, discordUserId: '3' })];
    useAuthStore().user = { id: 1, discordId: '2', name: 'Bob', username: 'bob', avatar: null };
  });

  it('permits only helpers and admins to remove a mark', () => {
    const current = useCurrentRoomStore();
    const locations = useLocationsStore();
    current.membership = { role: 'player', isOwner: false };
    expect(locations.canUnmarkFiller(row({}))).toBe(false);
    current.membership = { role: 'helper', isOwner: false };
    expect(locations.canUnmarkFiller(row({ finderSlotId: 8 }))).toBe(true);
    expect(locations.canUnmarkFiller(row({ fillerMarked: false }))).toBe(false);
    current.membership = { role: 'admin', isOwner: true };
    expect(locations.canUnmarkFiller(row({}))).toBe(true);
  });
});

describe('useCurrentRoomStore location access', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('shows the locations to players and to visitors only with the room setting', () => {
    const current = useCurrentRoomStore();
    current.room = room({});
    expect(current.canSeeLocations).toBe(false);
    current.membership = { role: 'player', isOwner: false };
    expect(current.canSeeLocations).toBe(true);
    current.membership = { role: 'visitor', isOwner: false };
    current.room = room({ visitorsSeeLocations: true });
    expect(current.canSeeLocations).toBe(true);
    current.room = room({ hasSeed: false, visitorsSeeLocations: true });
    expect(current.canSeeLocations).toBe(false);
  });

  it('treats helpers and admins as helpers', () => {
    const current = useCurrentRoomStore();
    current.membership = { role: 'helper', isOwner: false };
    expect([current.isHelper, current.isAdmin]).toEqual([true, false]);
    current.membership = { role: 'admin', isOwner: false };
    expect([current.isHelper, current.isAdmin]).toEqual([true, true]);
  });
});
