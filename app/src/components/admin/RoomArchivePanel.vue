<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';

import Button from 'primevue/button';
import Message from 'primevue/message';

import DateTimeText from '@/components/ui/DateTimeText.vue';

import { useCurrentRoomStore } from '@/stores/current-room';
import { useRoomArchiveStore } from '@/stores/room-archive';

const archiveStore = useRoomArchiveStore();
const { confirming, busy } = storeToRefs(archiveStore);
const { room, isArchived } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();
</script>

<template>
  <section v-if="room" class="app-form" data-testid="room-archive">
    <h2>{{ t('archive.title') }}</h2>
    <template v-if="isArchived">
      <p>
        {{ t('archive.archivedAt') }} <DateTimeText :value="room.archivedAt" />
        <span v-if="room.archiveReason" class="app-muted">({{ t(`archive.reasons.${room.archiveReason}`) }})</span>
      </p>
      <p class="app-muted">
        {{ room.archiveReason === 'auto' ? t('archive.reopenAutoHint') : t('archive.reopenHint') }}
      </p>
      <div class="app-toolbar">
        <Button
          :label="t('archive.reopen')"
          icon="pi pi-replay"
          :loading="busy"
          data-testid="reopen-room"
          @click="archiveStore.reopen()"
        />
      </div>
    </template>
    <template v-else>
      <p class="app-muted">{{ t('archive.intro') }}</p>
      <p class="app-muted">
        {{ room.autoArchive ? t('archive.autoOn') : t('archive.autoOff') }}
      </p>
      <div class="app-toolbar">
        <Button
          :label="t('archive.archive')"
          icon="pi pi-box"
          severity="secondary"
          :disabled="busy"
          data-testid="archive-room"
          @click="archiveStore.ask()"
        />
      </div>
      <Message v-if="confirming" severity="warn" :closable="false">
        <p>{{ t('archive.confirm') }}</p>
        <div class="app-toolbar">
          <Button
            :label="t('archive.archive')"
            size="small"
            :loading="busy"
            data-testid="confirm-archive"
            @click="archiveStore.archive()"
          />
          <Button :label="t('common.cancel')" size="small" text @click="archiveStore.cancel()" />
        </div>
      </Message>
    </template>
  </section>
</template>
