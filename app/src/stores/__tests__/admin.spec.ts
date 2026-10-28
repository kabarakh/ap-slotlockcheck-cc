import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useAdminStore } from '../admin';
import { useCurrentRoomStore } from '../current-room';
import { roomDetail } from '@/domain/__tests__/fixtures';

type Call = (path: string, options?: unknown) => Promise<unknown>;

const api = vi.hoisted(() => ({ PATCH: vi.fn<Call>() }));

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api,
}));

const noContent = () => Promise.resolve({ data: undefined, response: new Response(null, { status: 204 }) });

describe('useAdminStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.PATCH.mockReset();
    api.PATCH.mockReturnValue(noContent());
    useCurrentRoomStore().slug = 'big-chill';
  });

  const savedBody = async (hasSlotLock: boolean): Promise<unknown> => {
    useCurrentRoomStore().room = roomDetail({ hasSlotLock });
    const admin = useAdminStore();
    admin.settingsDraft = { title: 'Big Chill', yellowLimitHours: 24, redLimitHours: 48, slotLockPositions: [1] };
    await admin.saveSettings();
    const [, options] = api.PATCH.mock.calls[0] ?? [];
    return (options as { body: unknown } | undefined)?.body;
  };

  it('saves the selected SlotLock slots of a room with SlotLock', async () => {
    expect(await savedBody(true)).toEqual({
      title: 'Big Chill',
      yellowLimitHours: 24,
      redLimitHours: 48,
      slotLockPositions: [1],
    });
  });

  it('saves no SlotLock slots for a room without SlotLock', async () => {
    expect(await savedBody(false)).toEqual({ title: 'Big Chill', yellowLimitHours: 24, redLimitHours: 48 });
  });
});
