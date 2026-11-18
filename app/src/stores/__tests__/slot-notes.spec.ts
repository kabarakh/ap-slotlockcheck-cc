import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { useCurrentRoomStore } from '../current-room';
import { useSlotNotesStore } from '../slot-notes';
import { roomDetail, slotRow } from '@/domain/__tests__/fixtures';

type Call = (path: string, options?: unknown) => Promise<unknown>;

const api = vi.hoisted(() => ({ GET: vi.fn<Call>(), PUT: vi.fn<Call>() }));

vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/client')>()),
  api,
}));

const ok = (data: unknown) => Promise.resolve({ data, response: new Response(null, { status: 200 }) });
const note = { text: 'Away', updatedAt: '2026-11-18T12:00:00.000Z', updatedByName: 'Alice' };

describe('useSlotNotesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.GET.mockReset();
    api.PUT.mockReset();
    api.GET.mockReturnValue(ok([]));
    api.PUT.mockReturnValue(ok(note));
    const room = useCurrentRoomStore();
    room.slug = 'big-chill';
    room.room = roomDetail();
    room.membership = { role: 'helper', isOwner: false };
    room.slots = [slotRow({ id: 3, staffNote: note })];
  });

  it('starts the draft with the current notes of the slot', async () => {
    api.GET.mockReturnValue(ok([{ ...note, slotId: 3, text: 'Hidden' }]));
    const store = useSlotNotesStore();
    await store.fetchInternal();
    store.startEdit(3);
    expect(store.draft).toEqual({ slotId: 3, publicText: 'Away', internalText: 'Hidden' });
  });

  it('saves only the notes that changed', async () => {
    const store = useSlotNotesStore();
    store.startEdit(3);
    store.draft.internalText = 'Second reminder';
    await store.save();
    expect(api.PUT).toHaveBeenCalledTimes(1);
    expect(api.PUT).toHaveBeenCalledWith('/api/rooms/{slug}/slots/{slotId}/notes/{kind}', {
      params: { path: { slug: 'big-chill', slotId: 3, kind: 'internal' } },
      body: { text: 'Second reminder' },
    });
  });

  it('saves an empty public note when the text is removed', async () => {
    const store = useSlotNotesStore();
    store.startEdit(3);
    store.draft.publicText = '';
    await store.save();
    expect(api.PUT).toHaveBeenCalledWith('/api/rooms/{slug}/slots/{slotId}/notes/{kind}', {
      params: { path: { slug: 'big-chill', slotId: 3, kind: 'public' } },
      body: { text: '' },
    });
  });

  it('allows edits only for admins and helpers in a room that is not archived', () => {
    const room = useCurrentRoomStore();
    expect(useSlotNotesStore().canEdit).toBe(true);
    room.room = roomDetail({ archivedAt: '2026-11-18T12:00:00.000Z' });
    expect(useSlotNotesStore().canEdit).toBe(false);
    room.room = roomDetail();
    room.membership = { role: 'player', isOwner: false };
    expect(useSlotNotesStore().canEdit).toBe(false);
  });
});
