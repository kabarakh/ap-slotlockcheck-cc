import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api, ApiRequestError, unwrap } from '@/api/client';
import type {
  RoomDetail,
  RoomMembership,
  RoomSyncedPayload,
  RoomSyncFailedPayload,
  RoomUpdatedPayload,
  SlotRow,
} from '@/api/types';
import { useAuthStore } from './auth';
import { useLiveStore } from './live';
import { useUiStore } from './ui';
import { useWarningsStore } from './warnings';

export const useCurrentRoomStore = defineStore('currentRoom', () => {
  const slug = ref<string | null>(null);
  const room = ref<RoomDetail | null>(null);
  const slots = ref<SlotRow[]>([]);
  const membership = ref<RoomMembership>({ role: 'visitor', isOwner: false });
  const loading = ref(false);
  const notFound = ref(false);
  const syncRequested = ref(false);

  const isAdmin = computed(() => membership.value.role === 'admin');
  const isPlayer = computed(() => membership.value.role !== 'visitor');
  const slotById = computed(() => new Map(slots.value.map((slot) => [slot.id, slot])));
  const sortedSlots = computed(() => [...slots.value].sort((a, b) => a.position - b.position));
  const mySlots = computed(() => {
    const discordId = useAuthStore().user?.discordId;
    return discordId ? sortedSlots.value.filter((slot) => slot.discordUserId === discordId) : [];
  });
  const selectedLockers = computed(() => sortedSlots.value.filter((slot) => slot.isSelectedSlotLock));
  const slotLockSlots = computed(() => sortedSlots.value.filter((slot) => slot.isSlotLock));
  const playableSlots = computed(() => sortedSlots.value.filter((slot) => !slot.isSlotLock));
  const slotsWithoutDiscord = computed(() => playableSlots.value.filter((slot) => slot.discordUserId === null));

  const fetchMembership = async (roomSlug: string): Promise<void> => {
    membership.value = await unwrap(api.GET('/api/rooms/{slug}/me', { params: { path: { slug: roomSlug } } }));
  };

  const refreshWarnings = async (): Promise<void> => {
    if (membership.value.role === 'admin') {
      await useWarningsStore().fetch();
    } else {
      useWarningsStore().clear();
    }
  };

  const open = async (roomSlug: string): Promise<boolean> => {
    if (slug.value === roomSlug && room.value) {
      return true;
    }
    slug.value = roomSlug;
    loading.value = true;
    notFound.value = false;
    try {
      await useAuthStore().ensureLoaded();
      const path = { params: { path: { slug: roomSlug } } };
      const [detail, roster] = await Promise.all([
        unwrap(api.GET('/api/rooms/{slug}', path)),
        unwrap(api.GET('/api/rooms/{slug}/roster', path)),
        fetchMembership(roomSlug),
      ]);
      room.value = detail;
      slots.value = roster;
      useLiveStore().joinRoom(roomSlug);
      await refreshWarnings();
      return true;
    } catch (error) {
      room.value = null;
      slots.value = [];
      if (error instanceof ApiRequestError && error.status === 404) {
        notFound.value = true;
      } else {
        useUiStore().notifyError(error);
      }
      return false;
    } finally {
      loading.value = false;
    }
  };

  const reload = async (): Promise<void> => {
    const current = slug.value;
    room.value = null;
    if (current) {
      await open(current);
    }
  };

  const close = () => {
    useLiveStore().leaveRoom();
    slug.value = null;
    room.value = null;
    slots.value = [];
    membership.value = { role: 'visitor', isOwner: false };
    useWarningsStore().clear();
  };

  const applySynced = (payload: RoomSyncedPayload) => {
    if (payload.slug !== slug.value || !room.value) {
      return;
    }
    room.value = payload.room;
    const changed = new Map(payload.changedSlots.map((slot) => [slot.id, slot]));
    const removed = new Set(payload.removedSlotIds);
    const kept = slots.value.filter((slot) => !removed.has(slot.id)).map((slot) => changed.get(slot.id) ?? slot);
    const added = payload.changedSlots.filter((slot) => !slots.value.some((existing) => existing.id === slot.id));
    slots.value = [...kept, ...added];
  };

  const applySyncFailed = (payload: RoomSyncFailedPayload) => {
    if (payload.slug === slug.value && room.value) {
      room.value = { ...room.value, syncStatus: payload.syncStatus };
    }
  };

  const applyUpdated = (payload: RoomUpdatedPayload) => {
    if (payload.slug === slug.value) {
      room.value = payload.room;
      slots.value = payload.slots;
      void refreshWarnings();
    }
  };

  const requestSync = async (): Promise<void> => {
    if (!slug.value || !room.value) {
      return;
    }
    syncRequested.value = true;
    try {
      const path = { params: { path: { slug: slug.value } } };
      await unwrap(api.POST('/api/rooms/{slug}/sync', path));
      const [detail, roster] = await Promise.all([
        unwrap(api.GET('/api/rooms/{slug}', path)),
        unwrap(api.GET('/api/rooms/{slug}/roster', path)),
      ]);
      room.value = detail;
      slots.value = roster;
      useUiStore().notify('success', 'room.syncDone');
    } catch (error) {
      useUiStore().notifyError(error);
    } finally {
      syncRequested.value = false;
    }
  };

  return {
    slug,
    room,
    slots,
    membership,
    loading,
    notFound,
    syncRequested,
    isAdmin,
    isPlayer,
    slotById,
    sortedSlots,
    mySlots,
    selectedLockers,
    slotLockSlots,
    playableSlots,
    slotsWithoutDiscord,
    open,
    reload,
    close,
    applySynced,
    applySyncFailed,
    applyUpdated,
    requestSync,
  };
});
