<script setup lang="ts">
import { watchEffect } from 'vue';
import { RouterView } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AppHeader from '@/components/layout/AppHeader.vue';
import AppMessages from '@/components/layout/AppMessages.vue';
import { useUiStore } from '@/stores/ui';
import { applyColorMode } from '@/theme';

const ui = useUiStore();
const { locale } = useI18n({ useScope: 'global' });

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
