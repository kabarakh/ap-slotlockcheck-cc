import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api, unwrap } from '@/api/client';
import type { AdminRole, LockAssignment, RoomAdmin } from '@/api/types';
import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';

export interface SettingsDraft {
  title: string;
  yellowLimitHours: number;
  redLimitHours: number;
  slotLockPositions: number[];
}

export interface SphereSettingsDraft {
  sphereOffset: number;
  visitorsSeeLocations: boolean;
  playersMarkFiller: boolean;
}

export interface PlayerOption {
  discordId: string;
  name: string;
}

export const useAdminStore = defineStore('admin', () => {
  const admins = ref<RoomAdmin[]>([]);
  const lockAssignments = ref<LockAssignment[]>([]);
  const settingsDraft = ref<SettingsDraft>({ title: '', yellowLimitHours: 0, redLimitHours: 0, slotLockPositions: [] });
  const sphereSettingsDraft = ref<SphereSettingsDraft>({
    sphereOffset: 0,
    visitorsSeeLocations: false,
    playersMarkFiller: false,
  });
  const newAdminDiscordId = ref<string | null>(null);
  const newAdminRole = ref<AdminRole>('admin');
  const busy = ref(false);

  const slugPath = () => ({ params: { path: { slug: useCurrentRoomStore().slug ?? '' } } });

  const playerOptions = computed<PlayerOption[]>(() => {
    const adminIds = new Set(admins.value.map((admin) => admin.discordId));
    const options = new Map<string, PlayerOption>();
    for (const slot of useCurrentRoomStore().slots) {
      if (slot.discordUserId && !adminIds.has(slot.discordUserId)) {
        options.set(slot.discordUserId, {
          discordId: slot.discordUserId,
          name: slot.discordName ?? slot.discordUserId,
        });
      }
    }
    return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  const assignmentState = computed(() => {
    const state = new Map<string, LockAssignment>();
    for (const assignment of lockAssignments.value) {
      state.set(`${assignment.lockerSlotId}:${assignment.lockedSlotId}`, assignment);
    }
    return state;
  });

  const isLocked = (lockerSlotId: number, lockedSlotId: number): boolean => {
    const assignment = assignmentState.value.get(`${lockerSlotId}:${lockedSlotId}`);
    return assignment !== undefined && !assignment.notLocked;
  };

  const isOverridden = (lockerSlotId: number, lockedSlotId: number): boolean =>
    assignmentState.value.get(`${lockerSlotId}:${lockedSlotId}`)?.source === 'admin';

  const run = async <Result>(action: () => Promise<Result>, successKey?: string): Promise<Result | undefined> => {
    busy.value = true;
    try {
      const result = await action();
      if (successKey) {
        useUiStore().notify('success', successKey);
      }
      return result;
    } catch (error) {
      useUiStore().notifyError(error);
      return undefined;
    } finally {
      busy.value = false;
    }
  };

  const resetSettingsDraft = () => {
    const room = useCurrentRoomStore();
    settingsDraft.value = {
      title: room.room?.title ?? '',
      yellowLimitHours: room.room?.yellowLimitHours ?? 0,
      redLimitHours: room.room?.redLimitHours ?? 0,
      slotLockPositions: room.selectedLockers.map((slot) => slot.position),
    };
  };

  const resetSphereSettingsDraft = () => {
    const room = useCurrentRoomStore().room;
    sphereSettingsDraft.value = {
      sphereOffset: room?.sphereOffset ?? 0,
      visitorsSeeLocations: room?.visitorsSeeLocations ?? false,
      playersMarkFiller: room?.playersMarkFiller ?? false,
    };
  };

  const load = async (): Promise<void> => {
    resetSettingsDraft();
    resetSphereSettingsDraft();
    await run(async () => {
      const [adminList, assignments] = await Promise.all([
        unwrap(api.GET('/api/rooms/{slug}/admins', slugPath())),
        unwrap(api.GET('/api/rooms/{slug}/lock-assignments', slugPath())),
      ]);
      admins.value = adminList;
      lockAssignments.value = assignments;
    });
  };

  const saveSettings = () =>
    run(
      () =>
        unwrap(
          api.PATCH('/api/rooms/{slug}/settings', {
            ...slugPath(),
            body: {
              title: settingsDraft.value.title,
              yellowLimitHours: settingsDraft.value.yellowLimitHours,
              redLimitHours: settingsDraft.value.redLimitHours,
              slotLockPositions: settingsDraft.value.slotLockPositions,
            },
          }),
        ),
      'admin.settingsSaved',
    );

  const saveSphereSettings = () =>
    run(
      () => unwrap(api.PATCH('/api/rooms/{slug}/settings', { ...slugPath(), body: { ...sphereSettingsDraft.value } })),
      'admin.settingsSaved',
    );

  const useCheeseLimits = () =>
    run(
      () => unwrap(api.PATCH('/api/rooms/{slug}/settings', { ...slugPath(), body: { useCheeseLimits: true } })),
      'admin.settingsSaved',
    );

  const addAdmin = async () => {
    const discordId = newAdminDiscordId.value;
    if (!discordId) {
      return;
    }
    const result = await run(() =>
      unwrap(api.POST('/api/rooms/{slug}/admins', { ...slugPath(), body: { discordId, role: newAdminRole.value } })),
    );
    if (result) {
      admins.value = result;
      newAdminDiscordId.value = null;
    }
  };

  const removeAdmin = async (userId: number) => {
    const result = await run(() =>
      unwrap(
        api.DELETE('/api/rooms/{slug}/admins/{userId}', {
          params: { path: { slug: useCurrentRoomStore().slug ?? '', userId } },
        }),
      ),
    );
    if (result) {
      admins.value = result;
    }
  };

  const setLock = async (lockerSlotId: number, lockedSlotId: number, locked: boolean) => {
    const result = await run(() =>
      unwrap(
        api.PUT('/api/rooms/{slug}/lock-assignments', { ...slugPath(), body: { lockerSlotId, lockedSlotId, locked } }),
      ),
    );
    if (result) {
      lockAssignments.value = result;
    }
  };

  const resetLock = async (lockerSlotId: number, lockedSlotId: number) => {
    const result = await run(() =>
      unwrap(
        api.POST('/api/rooms/{slug}/lock-assignments/reset', { ...slugPath(), body: { lockerSlotId, lockedSlotId } }),
      ),
    );
    if (result) {
      lockAssignments.value = result;
    }
  };

  return {
    admins,
    lockAssignments,
    settingsDraft,
    sphereSettingsDraft,
    newAdminDiscordId,
    newAdminRole,
    busy,
    playerOptions,
    isLocked,
    isOverridden,
    resetSettingsDraft,
    resetSphereSettingsDraft,
    load,
    saveSettings,
    saveSphereSettings,
    useCheeseLimits,
    addAdmin,
    removeAdmin,
    setLock,
    resetLock,
  };
});
