import { loadFixture } from '../../../test/fixtures/fixtures.js';
import type { AppConfigService } from '../../config/app-config.service.js';
import { SourceFormatError } from '../http/source-errors.js';
import { SourceHttpService } from '../http/source-http.service.js';
import { CheeseService } from './cheese.service.js';

const config = {
  get: (key: string) =>
    ({ CHEESE_BASE_URL: 'https://cheese.test', HTTP_TIMEOUT_SECONDS: 5, HTTP_USER_AGENT: 'test' })[key],
} as unknown as AppConfigService;

function serviceReturning(body: unknown): { service: CheeseService; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return { service: new CheeseService(new SourceHttpService(config), config), fetchMock };
}

describe('CheeseService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates the tracker ID format', () => {
    expect(CheeseService.isValidTrackerId('AbCdEfGhIjKlMnOpQrStUv')).toBe(true);
    expect(CheeseService.isValidTrackerId('too-short')).toBe(false);
  });

  it('reads a tracker', async () => {
    const { service, fetchMock } = serviceReturning(loadFixture('cheese-tracker'));
    const tracker = await service.getTracker('AbCdEfGhIjKlMnOpQrStUv');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://cheese.test/api/tracker/AbCdEfGhIjKlMnOpQrStUv');
    expect(tracker.games).toHaveLength(6);
    expect(tracker.games[0]?.effective_discord_user_id).toBe('100000000000000001');
    expect(tracker.games[4]?.effective_discord_user_id).toBeUndefined();
  });

  it('reads the checks history', async () => {
    const { service, fetchMock } = serviceReturning(loadFixture('cheese-checks-history'));
    const history = await service.getChecksHistory('AbCdEfGhIjKlMnOpQrStUv');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://cheese.test/api/tracker/AbCdEfGhIjKlMnOpQrStUv/checks_history');
    expect(history[2]?.slots['102']).toBe(5);
  });

  it('rejects an unknown enum value', async () => {
    const tracker = loadFixture('cheese-tracker') as { games: { completion_status: string }[] };
    tracker.games[0].completion_status = 'finished';
    const { service } = serviceReturning(tracker);
    await expect(service.getTracker('AbCdEfGhIjKlMnOpQrStUv')).rejects.toThrow(SourceFormatError);
  });

  it('rejects an invalid tracker ID before a request', () => {
    const { service, fetchMock } = serviceReturning({});
    expect(() => service.getTracker('../../admin')).toThrow(/Invalid Cheese tracker ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
