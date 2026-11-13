import { loadFixture, type FixtureName } from '../../../test/fixtures/fixtures.js';
import type { AppConfigService } from '../../config/app-config.service.js';
import { SourceHttpService } from '../http/source-http.service.js';
import { isAllowedArchipelagoOrigin, parseArchipelagoLink } from './archipelago-link.js';
import { ArchipelagoService } from './archipelago.service.js';

const config = {
  get: (key: string) => ({ HTTP_TIMEOUT_SECONDS: 5, HTTP_USER_AGENT: 'test' })[key],
} as unknown as AppConfigService;

const origin = 'https://archipelago.gg';

function serviceReturning(name: FixtureName): { service: ArchipelagoService; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(loadFixture(name)), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return { service: new ArchipelagoService(new SourceHttpService(config)), fetchMock };
}

describe('ArchipelagoService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the room status', async () => {
    const { service, fetchMock } = serviceReturning('ap-room-status');
    const status = await service.getRoomStatus(origin, 'RoomIdOfTheRoomXX0001');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://archipelago.gg/api/room_status/RoomIdOfTheRoomXX0001');
    expect(status.players[0]).toEqual(['Locker', 'SlotLock']);
  });

  it('wakes a room with a visit of the room page', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await new ArchipelagoService(new SourceHttpService(config)).wakeRoom(origin, 'RoomIdOfTheRoomXX0001');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://archipelago.gg/room/RoomIdOfTheRoomXX0001');
  });

  it('refuses hosts outside the whitelist without a request', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const service = new ArchipelagoService(new SourceHttpService(config));
    expect(() => service.getRoomStatus('https://evil.example', 'x')).toThrow('ARCHIPELAGO_HOST_NOT_ALLOWED');
    expect(() => service.wakeRoom('http://169.254.169.254', 'x')).toThrow('ARCHIPELAGO_HOST_NOT_ALLOWED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the tracker with received items', async () => {
    const { service } = serviceReturning('ap-tracker');
    const tracker = await service.getTracker(origin, 'TrackerIdOfTheRoom0001');
    expect(tracker.player_items_received[0]?.items[0]).toEqual([1003, 20001, 3, 1]);
  });

  it('reads the static tracker', async () => {
    const { service } = serviceReturning('ap-static-tracker');
    const data = await service.getStaticTracker(origin, 'TrackerIdOfTheRoom0001');
    expect(data.datapackage['SlotLock']?.checksum).toBe('slotlockchecksum0001');
  });

  it('reads the slot data', async () => {
    const { service } = serviceReturning('ap-slot-data');
    const data = await service.getSlotData(origin, 'TrackerIdOfTheRoom0001');
    expect(data[0]?.slot_data['locked_slots']).toEqual(['Alice', 'Bob', 'Carol']);
  });

  it('reads a datapackage', async () => {
    const { service, fetchMock } = serviceReturning('ap-datapackage-slotlock');
    const datapackage = await service.getDatapackage(origin, 'slotlockchecksum0001');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://archipelago.gg/api/datapackage/slotlockchecksum0001');
    expect(datapackage.item_name_to_id['Unlock Alice']).toBe(1003);
  });
});

describe('parseArchipelagoLink', () => {
  it('reads origin and ID of room and tracker links', () => {
    expect(parseArchipelagoLink('https://archipelago.gg/tracker/abc', 'tracker')).toEqual({
      origin: 'https://archipelago.gg',
      id: 'abc',
    });
    expect(parseArchipelagoLink('https://ap.example.org:8080/room/xyz', 'room')).toEqual({
      origin: 'https://ap.example.org:8080',
      id: 'xyz',
    });
  });

  it('returns undefined for links without the expected part', () => {
    expect(parseArchipelagoLink('https://archipelago.gg/room/abc', 'tracker')).toBeUndefined();
    expect(parseArchipelagoLink('not a url', 'room')).toBeUndefined();
  });
});

describe('isAllowedArchipelagoOrigin', () => {
  it.each([
    'https://archipelago.gg',
    'https://multiworld.gg',
    'http://localhost:8080',
    'http://127.0.0.1:38281',
    'https://ap.ionium.us',
    'https://a.b.ionium.us:8443',
    'https://ARCHIPELAGO.GG',
  ])('allows %s', (origin) => {
    expect(isAllowedArchipelagoOrigin(origin)).toBe(true);
  });

  it.each([
    'https://ionium.us',
    'https://evilionium.us',
    'https://ionium.us.evil.example',
    'https://archipelago.gg.evil.example',
    'https://www.archipelago.gg',
    'https://example.org',
    'ftp://archipelago.gg',
    'not a url',
  ])('refuses %s', (origin) => {
    expect(isAllowedArchipelagoOrigin(origin)).toBe(false);
  });
});
