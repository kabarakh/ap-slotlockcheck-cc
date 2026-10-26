import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api, unwrap } from '@/api/client';
import type {
  ItemType,
  LocationAdminRow,
  LocationSlotScope,
  LocationSortField,
  LocationState,
  LocationUserRow,
  SortOrder,
} from '@/api/types';
import { useCurrentRoomStore } from './current-room';
import { useSphereOverviewStore } from './sphere-overview';
import { useUiStore } from './ui';

export type LocationView = 'user' | 'admin';

export interface LocationFilters {
  slots: LocationSlotScope;
  slotIds: number[];
  itemTypes: ItemType[];
  sphereRange: [number, number] | null;
}

export const DEFAULT_PAGE_SIZE = 50;

const emptyFilters = (): LocationFilters => ({ slots: 'all', slotIds: [], itemTypes: [], sphereRange: null });

export const useLocationsStore = defineStore(
  'locations',
  () => {
    const locationState = ref<LocationState | null>(null);
    const view = ref<LocationView>('user');
    const filters = ref<LocationFilters>(emptyFilters());
    const offset = ref(0);
    const limit = ref(DEFAULT_PAGE_SIZE);
    const sortField = ref<LocationSortField>('sphere');
    const sortOrder = ref<SortOrder>('asc');
    const rows = ref<(LocationUserRow | LocationAdminRow)[]>([]);
    const total = ref(0);
    const loading = ref(false);

    const isAdminView = computed(() => view.value === 'admin');

    const sphereBounds = computed<[number, number]>(() => {
      const overview = useSphereOverviewStore().overview;
      const maximum =
        locationState.value === 'open' && !isAdminView.value
          ? (overview?.visibleMaxSphere ?? 0)
          : (overview?.sphereCount ?? 0);
      return [0, maximum];
    });

    const canUnmarkFiller = (row: LocationUserRow): boolean => row.fillerMarked && useCurrentRoomStore().isHelper;

    const query = () => {
      const current = filters.value;
      return {
        state: locationState.value ?? 'open',
        slots: current.slots,
        slotIds: current.slots === 'selected' ? current.slotIds : undefined,
        itemTypes: isAdminView.value && current.itemTypes.length > 0 ? current.itemTypes : undefined,
        fromSphere: current.sphereRange?.[0],
        toSphere: current.sphereRange?.[1],
        excludeGoaled: useSphereOverviewStore().excludeGoaled,
        sort: sortField.value,
        order: sortOrder.value,
        offset: offset.value,
        limit: limit.value,
      };
    };

    const fetchPage = async (): Promise<void> => {
      const slug = useCurrentRoomStore().slug;
      if (!slug || !locationState.value) {
        return;
      }
      loading.value = true;
      try {
        const params = { params: { path: { slug }, query: query() } };
        const page = isAdminView.value
          ? await unwrap(api.GET('/api/rooms/{slug}/locations/admin', params))
          : await unwrap(api.GET('/api/rooms/{slug}/locations', params));
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

    const enter = async (state: LocationState, requestedView: LocationView): Promise<void> => {
      locationState.value = state;
      view.value = requestedView === 'admin' && useCurrentRoomStore().isHelper ? 'admin' : 'user';
      offset.value = 0;
      if (!isAdminView.value && (sortField.value === 'receiver' || sortField.value === 'item')) {
        sortField.value = 'sphere';
      }
      await useSphereOverviewStore().fetch();
      await fetchPage();
    };

    const leave = () => {
      locationState.value = null;
      rows.value = [];
      total.value = 0;
    };

    const setPage = async (firstRow: number, pageSize: number): Promise<void> => {
      offset.value = firstRow;
      limit.value = pageSize;
      await fetchPage();
    };

    const setSort = async (field: LocationSortField, order: SortOrder): Promise<void> => {
      sortField.value = field;
      sortOrder.value = order;
      offset.value = 0;
      await fetchPage();
    };

    const applyFilters = async (): Promise<void> => {
      offset.value = 0;
      await fetchPage();
    };

    const resetFilters = async (): Promise<void> => {
      filters.value = emptyFilters();
      await applyFilters();
    };

    const setFillerMark = async (id: number, marked: boolean): Promise<void> => {
      const slug = useCurrentRoomStore().slug;
      if (!slug) {
        return;
      }
      const params = { params: { path: { slug, id } } };
      try {
        await unwrap(
          marked
            ? api.PUT('/api/rooms/{slug}/locations/{id}/filler-mark', params)
            : api.DELETE('/api/rooms/{slug}/locations/{id}/filler-mark', params),
        );
        useUiStore().notify('success', marked ? 'locations.marked' : 'locations.unmarked');
        await fetchPage();
      } catch (error) {
        useUiStore().notifyError(error);
      }
    };

    const refresh = async (): Promise<void> => {
      if (locationState.value) {
        await fetchPage();
      }
    };

    return {
      locationState,
      view,
      filters,
      offset,
      limit,
      sortField,
      sortOrder,
      rows,
      total,
      loading,
      isAdminView,
      sphereBounds,
      canUnmarkFiller,
      fetchPage,
      enter,
      leave,
      setPage,
      setSort,
      applyFilters,
      resetFilters,
      setFillerMark,
      refresh,
    };
  },
  { persist: { pick: ['filters', 'limit'] } },
);
