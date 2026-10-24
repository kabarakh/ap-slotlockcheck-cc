import { z } from 'zod';
import type { AppConfigService } from '../../config/app-config.service.js';
import { SourceFormatError, SourceRequestError } from './source-errors.js';
import { SourceHttpService } from './source-http.service.js';

const config = {
  get: (key: string) => (key === 'HTTP_TIMEOUT_SECONDS' ? 5 : 'SlotlockTracker/test'),
} as unknown as AppConfigService;

describe('SourceHttpService', () => {
  const service = new SourceHttpService(config);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns validated data and sends the user agent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(service.getJson('https://example.org/a', z.object({ value: z.number() }))).resolves.toEqual({
      value: 1,
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['user-agent']).toBe('SlotlockTracker/test');
  });

  it('throws a format error with the path of the wrong field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ value: 'x' }), { status: 200 })));
    await expect(service.getJson('https://example.org/a', z.object({ value: z.number() }))).rejects.toThrow(
      SourceFormatError,
    );
  });

  it('throws a request error for HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
    await expect(service.getJson('https://example.org/a', z.unknown())).rejects.toThrow(SourceRequestError);
  });
});
