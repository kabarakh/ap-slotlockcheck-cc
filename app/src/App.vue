<script setup lang="ts">
import { useTitle } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView, useRoute } from 'vue-router';

import AppHeader from '@/components/layout/AppHeader.vue';
import AppMessages from '@/components/layout/AppMessages.vue';

import { windowTitle } from '@/domain/window-title';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useUiStore } from '@/stores/ui';
import { applyColorMode } from '@/theme';

const ui = useUiStore();
const { locale, t, te } = useI18n({ useScope: 'global' });
const { room } = storeToRefs(useCurrentRoomStore());

const route = useRoute();

const viewTitle = computed(() => {
  const keys = route.meta.title ?? [];
  const tab = route.name === 'admin' ? String(route.params['tab'] ?? '') : '';
  const tabKey = `admin.tabs.${tab}`;
  return [...(tab && te(tabKey) ? [tabKey] : []), ...keys].map((key) => t(key));
});

useTitle(computed(() => windowTitle([...viewTitle.value, room.value?.title], t('app.title'))));

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
