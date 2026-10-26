import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { api, unwrap } from '@/api/client';
import type { RoomDetail, RoomPreview } from '@/api/types';
import { useUiStore } from './ui';

export const TRACKER_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function trackerIdFromInput(input: string): string {
  const trimmed = input.trim();
  const fromUrl = /\/tracker\/([A-Za-z0-9_-]{22})/.exec(trimmed);
  return fromUrl?.[1] ?? trimmed;
}

export const useRoomSetupStore = defineStore('roomSetup', () => {
  const trackerInput = ref('');
  const preview = ref<RoomPreview | null>(null);
  const slug = ref('');
  const title = ref('');
  const slotLockPositions = ref<number[]>([]);
  const busy = ref(false);

  const trackerId = computed(() => trackerIdFromInput(trackerInput.value));
  const isTrackerIdValid = computed(() => TRACKER_ID_PATTERN.test(trackerId.value));
  const isSlugValid = computed(() => SLUG_PATTERN.test(slug.value));
  const canCreate = computed(
    () =>
      preview.value !== null &&
      preview.value.ownerCheck !== 'failed' &&
      preview.value.existingSlug === null &&
      isSlugValid.value &&
      title.value.trim().length > 0 &&
      slotLockPositions.value.length > 0 &&
      !busy.value,
  );

  const reset = () => {
    trackerInput.value = '';
    preview.value = null;
    slug.value = '';
    title.value = '';
    slotLockPositions.value = [];
  };

  const loadPreview = async (): Promise<void> => {
    if (!isTrackerIdValid.value) {
      return;
    }
    busy.value = true;
    try {
      const result = await unwrap(api.POST('/api/room-setup/preview', { body: { cheeseTrackerId: trackerId.value } }));
      preview.value = result;
      slug.value = result.suggestedSlug;
      title.value = result.title;
      slotLockPositions.value = result.slotLockSlots.map((slot) => slot.position);
    } catch (error) {
      preview.value = null;
      useUiStore().notifyError(error);
    } finally {
      busy.value = false;
    }
  };

  const create = async (): Promise<RoomDetail | null> => {
    if (!canCreate.value) {
      return null;
    }
    busy.value = true;
    try {
      const room = await unwrap(
        api.POST('/api/room-setup', {
          body: {
            cheeseTrackerId: trackerId.value,
            slug: slug.value,
            title: title.value.trim(),
            slotLockPositions: slotLockPositions.value,
          },
        }),
      );
      reset();
      return room;
    } catch (error) {
      useUiStore().notifyError(error);
      return null;
    } finally {
      busy.value = false;
    }
  };

  return {
    trackerInput,
    preview,
    slug,
    title,
    slotLockPositions,
    busy,
    trackerId,
    isTrackerIdValid,
    isSlugValid,
    canCreate,
    reset,
    loadPreview,
    create,
  };
});
