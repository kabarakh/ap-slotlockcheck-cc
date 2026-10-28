import { defineStore } from 'pinia';
import { ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';
import { api, ApiRequestError, unwrap } from '@/api/client';
import type { SeedData } from '@/api/types';

export const useSeedStore = defineStore('seed', () => {
  const seed = ref<SeedData | null>(null);
  const differences = ref<string[]>([]);
  const busy = ref(false);

  const slugPath = () => ({ params: { path: { slug: useCurrentRoomStore().slug ?? '' } } });

  const fetch = async (): Promise<void> => {
    if (!useCurrentRoomStore().room?.hasSeed) {
      seed.value = null;
      return;
    }
    try {
      seed.value = await unwrap(api.GET('/api/rooms/{slug}/seed', slugPath()));
    } catch (error) {
      useUiStore().notifyError(error);
    }
  };

  const upload = async (file: File): Promise<void> => {
    busy.value = true;
    differences.value = [];
    try {
      seed.value = await unwrap(
        api.POST('/api/rooms/{slug}/seed', {
          ...slugPath(),
          body: { file: file as unknown as string },
          bodySerializer: (body) => {
            const form = new FormData();
            form.append('file', body.file as unknown as File);
            return form;
          },
        }),
      );
      useUiStore().notify('success', 'seed.uploaded');
    } catch (error) {
      const reported = error instanceof ApiRequestError ? error.details?.['differences'] : undefined;
      differences.value = Array.isArray(reported) ? reported.map(String) : [];
      useUiStore().notifyError(error);
    } finally {
      busy.value = false;
    }
  };

  const clear = () => {
    seed.value = null;
    differences.value = [];
  };

  return { seed, differences, busy, fetch, upload, clear };
});
