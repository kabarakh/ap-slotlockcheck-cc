import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useSphereOverviewStore } from './sphere-overview';
import { useUiStore } from './ui';
import { api, unwrap } from '@/api/client';
import type { CleanupSlotMode, SphereCleanupEntry } from '@/api/types';
import { buildCleanupMessages, ENGLISH_CLEANUP_TEXTS } from '@/domain/cleanup-message';

export interface CleanupDraft {
  fromSphere: number;
  toSphere: number;
  slots: CleanupSlotMode;
  excludeGoaled: boolean;
  pings: boolean;
}

export const useSphereCleanupStore = defineStore(
  'sphereCleanup',
  () => {
    const draft = ref<CleanupDraft>({ fromSphere: 0, toSphere: 0, slots: 'all', excludeGoaled: false, pings: true });
    const entries = ref<SphereCleanupEntry[]>([]);
    const range = ref<{ fromSphere: number; toSphere: number } | null>(null);
    const loading = ref(false);
    const presetSphereValue = ref<number | null>(null);

    const messages = computed(() => {
      if (!range.value) {
        return [];
      }
      return buildCleanupMessages(entries.value, { ...range.value, pings: draft.value.pings }, ENGLISH_CLEANUP_TEXTS);
    });

    const presetSphere = (sphere: number) => {
      presetSphereValue.value = sphere;
    };

    const prepare = async (): Promise<boolean> => {
      const preset = presetSphereValue.value;
      presetSphereValue.value = null;
      entries.value = [];
      range.value = null;
      if (preset !== null) {
        draft.value = { ...draft.value, fromSphere: preset, toSphere: preset };
        await fetch();
        return true;
      }
      const overview = useSphereOverviewStore();
      await overview.fetch();
      const lowest = overview.overview?.lowestOpenSphere ?? 0;
      draft.value = { ...draft.value, fromSphere: lowest, toSphere: lowest };
      return false;
    };

    const fetch = async (): Promise<void> => {
      const slug = useCurrentRoomStore().slug;
      if (!slug) {
        return;
      }
      loading.value = true;
      try {
        const { fromSphere, toSphere, slots, excludeGoaled } = draft.value;
        const result = await unwrap(
          api.GET('/api/rooms/{slug}/sphere-cleanup', {
            params: { path: { slug }, query: { fromSphere, toSphere, slots, excludeGoaled } },
          }),
        );
        entries.value = result.entries;
        range.value = { fromSphere: result.fromSphere, toSphere: result.toSphere };
      } catch (error) {
        useUiStore().notifyError(error);
      } finally {
        loading.value = false;
      }
    };

    const copy = async (index: number): Promise<void> => {
      const message = messages.value[index];
      if (message !== undefined) {
        await navigator.clipboard.writeText(message);
        useUiStore().notify('success', 'cleanup.copied');
      }
    };

    return { draft, entries, range, loading, messages, presetSphere, prepare, fetch, copy };
  },
  { persist: { pick: ['draft'] } },
);
