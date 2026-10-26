<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { RouterLink, RouterView } from 'vue-router';

import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';

import RoomHeader from '@/components/room/RoomHeader.vue';

import { useCurrentRoomStore } from '@/stores/current-room';

const { room, loading, notFound } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();
</script>

<template>
  <ProgressSpinner v-if="loading && !room" />
  <Message v-else-if="notFound" severity="warn">
    {{ t('room.notFound') }} <RouterLink :to="{ name: 'rooms' }">{{ t('app.rooms') }}</RouterLink>
  </Message>
  <template v-else-if="room">
    <RoomHeader />
    <RouterView />
  </template>
</template>
