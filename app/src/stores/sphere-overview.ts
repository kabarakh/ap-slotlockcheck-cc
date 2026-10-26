import { ref } from 'vue';
import { defineStore } from 'pinia';
import { api, unwrap } from '@/api/client';
import type { SphereOverview } from '@/api/types';
import { useCurrentRoomStore } from './current-room';
import { useUiStore } from './ui';

export const useSphereOverviewStore = defineStore(
  'sphereOverview',
  () => {
    const overview = ref<SphereOverview | null>(null);
    const excludeGoaled = ref(false);
    const loading = ref(false);

    const fetch = async (): Promise<void> => {
      const room = useCurrentRoomStore();
      if (!room.slug || !room.room?.hasSeed) {
        overview.value = null;
        return;
      }
      loading.value = true;
      try {
        overview.value = await unwrap(
          api.GET('/api/rooms/{slug}/spheres', {
            params: { path: { slug: room.slug }, query: { excludeGoaled: excludeGoaled.value } },
          }),
        );
      } catch (error) {
        useUiStore().notifyError(error);
      } finally {
        loading.value = false;
      }
    };

    const setExcludeGoaled = async (value: boolean): Promise<void> => {
      excludeGoaled.value = value;
      await fetch();
    };

    const clear = () => {
      overview.value = null;
    };

    return { overview, excludeGoaled, loading, fetch, setExcludeGoaled, clear };
  },
  { persist: { pick: ['excludeGoaled'] } },
);
