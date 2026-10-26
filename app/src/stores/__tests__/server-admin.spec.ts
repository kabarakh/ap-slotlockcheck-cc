import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { ServerJob } from '@/api/types';
import { slotRow } from '@/domain/__tests__/fixtures';
import { useCurrentRoomStore } from '../current-room';
import { JOB_POLL_MILLISECONDS, useServerAdminStore } from '../server-admin';
import { useUiStore } from '../ui';

type Call = (path: string, options?: unknown) => Promise<unknown>;

const api = vi.hoisted(() => ({
  GET: vi.fn<Call>(),
  POST: vi.fn<Call>(),
  PUT: vi.fn<Call>(),
  DELETE: vi.fn<Call>(),
}));

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api,
}));

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });

const job = (overrides: Partial<ServerJob>): ServerJob => ({
  id: 'job-1',
  command: 'release',
  total: 1,
  done: 0,
  errors: [],
  state: 'running',
  startedAt: '2026-10-26T00:00:00.000Z',
  finishedAt: null,
  ...overrides,
});

describe('useServerAdminStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    Object.values(api).forEach((mock) => mock.mockReset());
    const room = useCurrentRoomStore();
    room.slug = 'big-chill';
    room.slots = [slotRow({ id: 4, name: 'Bob' })];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('forgets the passwords after the login request', async () => {
    api.PUT.mockReturnValue(ok({ loggedIn: true, slotId: 1, job: null }));
    const store = useServerAdminStore();
    store.loginDraft = { slotId: 1, serverPassword: 'secret', roomPassword: '' };
    await store.login();
    expect(api.PUT).toHaveBeenCalledWith('/api/rooms/{slug}/server-admin/login', {
      params: { path: { slug: 'big-chill' } },
      body: { slotId: 1, serverPassword: 'secret', roomPassword: undefined },
    });
    expect(store.loginDraft).toEqual({ slotId: 1, serverPassword: '', roomPassword: '' });
    expect(store.loggedIn).toBe(true);
  });

  it('asks for a confirmation before a release and runs it after the confirmation', async () => {
    api.POST.mockReturnValue(ok(job({})));
    api.GET.mockReturnValue(ok(job({ state: 'done', done: 1 })));
    const store = useServerAdminStore();
    store.commandSlotId = 4;
    store.askSlotCommand('release');
    expect(store.pending).toEqual({ kind: 'release', slotId: 4, slotName: 'Bob' });
    expect(useUiStore().openDialogName).toBe('serverConfirm');
    expect(api.POST).not.toHaveBeenCalled();
    await store.confirmPending();
    expect(api.POST).toHaveBeenCalledWith('/api/rooms/{slug}/server-admin/release', {
      params: { path: { slug: 'big-chill' } },
      body: { slotId: 4 },
    });
    expect(store.jobRunning).toBe(true);
    await vi.advanceTimersByTimeAsync(JOB_POLL_MILLISECONDS);
    expect(store.job?.state).toBe('done');
    await vi.advanceTimersByTimeAsync(JOB_POLL_MILLISECONDS * 3);
    expect(api.GET).toHaveBeenCalledTimes(1);
  });

  it('shows the preview before a release of spheres and can cancel it', async () => {
    api.GET.mockReturnValue(ok({ locationCount: 12, progressionCount: 0 }));
    const store = useServerAdminStore();
    store.releaseDraft = { fromSphere: 3, toSphere: 5, mode: 'filler' };
    await store.askReleaseSpheres();
    expect(store.pending).toEqual({
      kind: 'releaseSpheres',
      draft: { fromSphere: 3, toSphere: 5, mode: 'filler' },
      preview: { locationCount: 12, progressionCount: 0 },
    });
    store.cancelPending();
    expect(store.pending).toBeNull();
    expect(api.POST).not.toHaveBeenCalled();
  });

  it('stops the polling when the room changes', async () => {
    api.POST.mockReturnValue(ok(job({})));
    api.GET.mockReturnValue(ok(job({})));
    const store = useServerAdminStore();
    await store.sendLocation(9);
    store.clear();
    await vi.advanceTimersByTimeAsync(JOB_POLL_MILLISECONDS * 3);
    expect(api.GET).not.toHaveBeenCalled();
    expect(store.status).toBeNull();
  });
});
