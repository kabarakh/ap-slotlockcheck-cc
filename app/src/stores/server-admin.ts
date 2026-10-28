import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';
import { api, unwrap } from '@/api/client';
import type { ReleaseMode, ReleasePreview, ServerAdminStatus, ServerJob } from '@/api/types';

export const JOB_POLL_MILLISECONDS = 1000;

export interface LoginDraft {
  slotId: number | null;
  serverPassword: string;
  roomPassword: string;
}

export interface ItemDraft {
  slotId: number | null;
  itemName: string;
  amount: number;
}

export interface ReleaseDraft {
  fromSphere: number;
  toSphere: number;
  mode: ReleaseMode;
}

export type PendingCommand =
  | { kind: 'release' | 'collect'; slotId: number; slotName: string }
  | { kind: 'releaseSpheres'; draft: ReleaseDraft; preview: ReleasePreview };

const emptyLogin = (): LoginDraft => ({ slotId: null, serverPassword: '', roomPassword: '' });

export const useServerAdminStore = defineStore('serverAdmin', () => {
  const status = ref<ServerAdminStatus | null>(null);
  const loginDraft = ref<LoginDraft>(emptyLogin());
  const itemDraft = ref<ItemDraft>({ slotId: null, itemName: '', amount: 1 });
  const releaseDraft = ref<ReleaseDraft>({ fromSphere: 0, toSphere: 0, mode: 'filler' });
  const itemNames = ref<string[]>([]);
  const commandSlotId = ref<number | null>(null);
  const pending = ref<PendingCommand | null>(null);
  const busy = ref(false);
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  const loggedIn = computed(() => status.value?.loggedIn ?? false);
  const job = computed<ServerJob | null>(() => status.value?.job ?? null);
  const jobRunning = computed(() => job.value?.state === 'running');

  const slugPath = () => ({ params: { path: { slug: useCurrentRoomStore().slug ?? '' } } });

  const run = async <Result>(action: () => Promise<Result>): Promise<Result | undefined> => {
    busy.value = true;
    try {
      return await action();
    } catch (error) {
      useUiStore().notifyError(error);
      return undefined;
    } finally {
      busy.value = false;
    }
  };

  const stopPolling = () => {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const fetchStatus = async (): Promise<void> => {
    const result = await run(() => unwrap(api.GET('/api/rooms/{slug}/server-admin', slugPath())));
    if (result) {
      status.value = result;
      if (result.job?.state === 'running') {
        schedulePoll();
      }
    }
  };

  const applyJob = (next: ServerJob) => {
    status.value = { loggedIn: status.value?.loggedIn ?? true, slotId: status.value?.slotId ?? null, job: next };
    if (next.state === 'running') {
      schedulePoll();
    } else {
      stopPolling();
    }
  };

  const pollJob = async (): Promise<void> => {
    pollTimer = null;
    try {
      applyJob(await unwrap(api.GET('/api/rooms/{slug}/server-admin/job', slugPath())));
    } catch (error) {
      useUiStore().notifyError(error);
    }
  };

  function schedulePoll() {
    stopPolling();
    pollTimer = setTimeout(() => void pollJob(), JOB_POLL_MILLISECONDS);
  }

  const login = async (): Promise<void> => {
    const draft = loginDraft.value;
    const result = await run(() =>
      unwrap(
        api.PUT('/api/rooms/{slug}/server-admin/login', {
          ...slugPath(),
          body: {
            slotId: draft.slotId ?? undefined,
            serverPassword: draft.serverPassword,
            roomPassword: draft.roomPassword || undefined,
          },
        }),
      ),
    );
    loginDraft.value = { ...emptyLogin(), slotId: draft.slotId };
    if (result) {
      status.value = result;
      useUiStore().notify('success', 'server.loggedIn');
    }
  };

  const logout = async (): Promise<void> => {
    const result = await run(() => unwrap(api.DELETE('/api/rooms/{slug}/server-admin/login', slugPath())));
    if (result) {
      status.value = result;
    }
  };

  const started = (result: ServerJob | undefined) => {
    if (result) {
      applyJob(result);
      useUiStore().notify('info', 'server.started');
    }
  };

  const sendLocation = async (locationId: number): Promise<void> => {
    started(
      await run(() =>
        unwrap(
          api.POST('/api/rooms/{slug}/server-admin/send-location', {
            ...slugPath(),
            body: { locationIds: [locationId] },
          }),
        ),
      ),
    );
  };

  const loadItemNames = async (slotId: number | null): Promise<void> => {
    itemDraft.value = { ...itemDraft.value, slotId, itemName: '' };
    itemNames.value = [];
    if (slotId === null) {
      return;
    }
    const result = await run(() =>
      unwrap(
        api.GET('/api/rooms/{slug}/server-admin/items', {
          params: { path: { slug: useCurrentRoomStore().slug ?? '' }, query: { slotId } },
        }),
      ),
    );
    itemNames.value = result?.itemNames ?? [];
  };

  const sendItem = async (): Promise<void> => {
    const draft = itemDraft.value;
    if (draft.slotId === null || draft.itemName.trim().length === 0) {
      return;
    }
    const slotId = draft.slotId;
    started(
      await run(() =>
        unwrap(
          api.POST('/api/rooms/{slug}/server-admin/send-item', {
            ...slugPath(),
            body: { slotId, itemName: draft.itemName.trim(), amount: draft.amount },
          }),
        ),
      ),
    );
  };

  const askSlotCommand = (kind: 'release' | 'collect') => {
    const slot = useCurrentRoomStore().slotById.get(commandSlotId.value ?? -1);
    if (slot) {
      pending.value = { kind, slotId: slot.id, slotName: slot.name };
      useUiStore().openDialog('serverConfirm');
    }
  };

  const askReleaseSpheres = async (): Promise<void> => {
    const draft = { ...releaseDraft.value };
    const preview = await run(() =>
      unwrap(
        api.GET('/api/rooms/{slug}/server-admin/release-spheres/preview', {
          params: { path: { slug: useCurrentRoomStore().slug ?? '' }, query: draft },
        }),
      ),
    );
    if (preview) {
      pending.value = { kind: 'releaseSpheres', draft, preview };
      useUiStore().openDialog('serverConfirm');
    }
  };

  const confirmPending = async (): Promise<void> => {
    const command = pending.value;
    pending.value = null;
    useUiStore().closeDialog();
    if (!command) {
      return;
    }
    if (command.kind === 'releaseSpheres') {
      started(
        await run(() =>
          unwrap(api.POST('/api/rooms/{slug}/server-admin/release-spheres', { ...slugPath(), body: command.draft })),
        ),
      );
      return;
    }
    const path =
      command.kind === 'release' ? '/api/rooms/{slug}/server-admin/release' : '/api/rooms/{slug}/server-admin/collect';
    started(await run(() => unwrap(api.POST(path, { ...slugPath(), body: { slotId: command.slotId } }))));
  };

  const cancelPending = () => {
    pending.value = null;
    useUiStore().closeDialog();
  };

  const stopJob = async (): Promise<void> => {
    const current = job.value;
    if (!current) {
      return;
    }
    const result = await run(() =>
      unwrap(
        api.DELETE('/api/rooms/{slug}/server-admin/jobs/{id}', {
          params: { path: { slug: useCurrentRoomStore().slug ?? '', id: current.id } },
        }),
      ),
    );
    if (result) {
      applyJob(result);
    }
  };

  const clear = () => {
    stopPolling();
    status.value = null;
    loginDraft.value = emptyLogin();
    pending.value = null;
    itemNames.value = [];
  };

  return {
    status,
    loginDraft,
    itemDraft,
    releaseDraft,
    itemNames,
    commandSlotId,
    pending,
    busy,
    loggedIn,
    job,
    jobRunning,
    fetchStatus,
    pollJob,
    login,
    logout,
    sendLocation,
    loadItemNames,
    sendItem,
    askSlotCommand,
    askReleaseSpheres,
    confirmPending,
    cancelPending,
    stopJob,
    clear,
  };
});
