<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { storeToRefs } from 'pinia';
import { useTitle } from '@vueuse/core';
import { RouterView } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppMessages from '@/components/layout/AppMessages.vue';
import { windowTitle } from '@/domain/window-title';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useUiStore } from '@/stores/ui';
import { applyColorMode } from '@/theme';

const ui = useUiStore();
const { locale, t } = useI18n({ useScope: 'global' });
const { room } = storeToRefs(useCurrentRoomStore());

useTitle(computed(() => windowTitle(room.value?.title, t('app.title'))));

watchEffect(() => {
  locale.value = ui.locale;
  document.documentElement.lang = ui.locale;
  applyColorMode(ui.isDark);
});
</script>

<template>
  <AppHeader />
  <AppMessages />
  <main class="app-main">
    <RouterView />
  </main>
</template>
