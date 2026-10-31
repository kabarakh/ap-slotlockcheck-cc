import { defineStore } from 'pinia';
import { ref } from 'vue';

import { useCurrentRoomStore } from './current-room';
import { useSphereOverviewStore } from './sphere-overview';
import { useUiStore } from './ui';
import { api, unwrap } from '@/api/client';
import type { LocationAdminRow } from '@/api/types';

export const SPHERE_LOCATIONS_PAGE_SIZE = 50;

export const useSphereLocationsStore = defineStore('sphereLocations', () => {
  const sphere = ref<number | null>(null);
  const rows = ref<LocationAdminRow[]>([]);
  const total = ref(0);
  const offset = ref(0);
  const loading = ref(false);

  const fetchPage = async (): Promise<void> => {
    const slug = useCurrentRoomStore().slug;
    if (!slug || sphere.value === null) {
      return;
    }
    loading.value = true;
    try {
      const page = await unwrap(
        api.GET('/api/rooms/{slug}/locations/admin', {
          params: {
            path: { slug },
            query: {
              state: 'open',
              slots: 'all',
              fromSphere: sphere.value,
              toSphere: sphere.value,
              excludeGoaled: useSphereOverviewStore().excludeGoaled,
              sort: 'finder',
              order: 'asc',
              offset: offset.value,
              limit: SPHERE_LOCATIONS_PAGE_SIZE,
            },
          },
        }),
      );
      rows.value = page.rows;
      total.value = page.total;
    } catch (error) {
      rows.value = [];
      total.value = 0;
      useUiStore().notifyError(error);
    } finally {
      loading.value = false;
    }
  };

  const open = async (selected: number): Promise<void> => {
    sphere.value = selected;
    offset.value = 0;
    rows.value = [];
    await fetchPage();
  };

  const close = () => {
    sphere.value = null;
    rows.value = [];
    total.value = 0;
  };

  const setPage = async (firstRow: number): Promise<void> => {
    offset.value = firstRow;
    await fetchPage();
  };

  return { sphere, rows, total, offset, loading, open, close, setPage, fetchPage };
});
