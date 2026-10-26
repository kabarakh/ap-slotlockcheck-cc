<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';

import { useRoomSetupStore } from '@/stores/room-setup';

const setup = useRoomSetupStore();
const { trackerInput, preview, slug, title, slotLockPositions, busy, isTrackerIdValid, isSlugValid, canCreate } =
  storeToRefs(setup);
const { t } = useI18n();
const router = useRouter();

const createRoom = async () => {
  const room = await setup.create();
  if (room) {
    await router.push({ name: 'roster', params: { slug: room.slug } });
  }
};
</script>

<template>
  <section class="app-form">
    <h1>{{ t('roomSetup.title') }}</h1>
    <p class="app-muted">{{ t('roomSetup.intro') }}</p>
    <form class="app-toolbar" @submit.prevent="setup.loadPreview()">
      <InputText
        v-model="trackerInput"
        :placeholder="t('roomSetup.trackerPlaceholder')"
        :invalid="trackerInput.length > 0 && !isTrackerIdValid"
        class="tracker-input"
        data-testid="tracker-input"
      />
      <Button
        type="submit"
        :label="t('roomSetup.check')"
        :disabled="!isTrackerIdValid"
        :loading="busy"
        data-testid="preview-button"
      />
    </form>

    <template v-if="preview">
      <Message v-if="preview.existingSlug" severity="warn">
        {{ t('roomSetup.alreadyExists', { slug: preview.existingSlug }) }}
      </Message>
      <Message v-if="preview.ownerCheck === 'failed'" severity="error" data-testid="owner-check-failed">
        <p>{{ t('roomSetup.ownerCheckFailed', { owner: preview.ownerDiscordName ?? t('common.unknown') }) }}</p>
        <ul>
          <li>{{ t('roomSetup.ownerHintClaim') }}</li>
          <li>{{ t('roomSetup.ownerHintLogin') }}</li>
          <li>{{ t('roomSetup.ownerHintOwner') }}</li>
        </ul>
      </Message>
      <Message v-else severity="success">{{ t(`roomSetup.ownerCheck.${preview.ownerCheck}`) }}</Message>

      <form class="app-form" @submit.prevent="createRoom">
        <label class="app-field">
          {{ t('roomSetup.roomTitle') }}
          <InputText v-model="title" data-testid="room-title" />
        </label>
        <label class="app-field">
          {{ t('roomSetup.slug') }}
          <InputText v-model="slug" :invalid="!isSlugValid" data-testid="room-slug" />
          <span class="app-muted">/room/{{ slug }}</span>
        </label>
        <fieldset class="app-field">
          <legend>{{ t('roomSetup.slotLockSlots') }}</legend>
          <p v-if="preview.slotLockSlots.length === 0" class="app-muted">{{ t('roomSetup.noSlotLockSlots') }}</p>
          <label v-for="candidate in preview.slotLockSlots" :key="candidate.position" class="app-toolbar">
            <Checkbox v-model="slotLockPositions" :value="candidate.position" />
            #{{ candidate.position }} {{ candidate.name }}
          </label>
        </fieldset>
        <Button
          type="submit"
          :label="t('roomSetup.create')"
          :disabled="!canCreate"
          :loading="busy"
          data-testid="create-room-button"
        />
      </form>
    </template>
  </section>
</template>

<style scoped>
.tracker-input {
  min-width: 24rem;
}

fieldset {
  border: none;
  padding: 0;
}
</style>
