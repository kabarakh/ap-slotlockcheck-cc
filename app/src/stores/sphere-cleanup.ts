import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api, unwrap } from '@/api/client';
import type { CleanupSlotMode, SphereCleanupEntry } from '@/api/types';
import { buildCleanupMessages, type CleanupCounts } from '@/domain/cleanup-message';
import { i18n } from '@/i18n';
import { useCurrentRoomStore } from './current-room';
import { useSphereOverviewStore } from './sphere-overview';
import { useUiStore } from './ui';

export interface CleanupDraft {
  fromSphere: number;
  toSphere: number;
  slots: CleanupSlotMode;
  excludeGoaled: boolean;
  pings: boolean;
}

const countParams = (counts: CleanupCounts) => ({ ...counts });

export const useSphereCleanupStore = defineStore('sphereCleanup', () => {
  const draft = ref<CleanupDraft>({ fromSphere: 0, toSphere: 0, slots: 'all', excludeGoaled: false, pings: true });
  const entries = ref<SphereCleanupEntry[]>([]);
  const range = ref<{ fromSphere: number; toSphere: number } | null>(null);
  const loading = ref(false);

  const messages = computed(() => {
    if (!range.value) {
      return [];
    }
    const t = i18n.global.t;
    return buildCleanupMessages(
      entries.value,
      { ...range.value, pings: draft.value.pings },
      {
        title: (from, to) =>
          from === to ? t('cleanup.message.title', { sphere: from }) : t('cleanup.message.titleRange', { from, to }),
        line: (user, slotName, counts) => t('cleanup.message.line', { user, slot: slotName, ...countParams(counts) }),
        lineWithoutUser: (slotName, counts) =>
          t('cleanup.message.lineWithoutUser', { slot: slotName, ...countParams(counts) }),
      },
    );
  });

  const prepare = async (): Promise<void> => {
    const overview = useSphereOverviewStore();
    await overview.fetch();
    const lowest = overview.overview?.lowestOpenSphere ?? 0;
    draft.value = { ...draft.value, fromSphere: lowest, toSphere: lowest };
    entries.value = [];
    range.value = null;
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

  return { draft, entries, range, loading, messages, prepare, fetch, copy };
});
