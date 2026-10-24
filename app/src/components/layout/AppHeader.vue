<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';
import Button from 'primevue/button';
import Select from 'primevue/select';
import { useAuthStore } from '@/stores/auth';
import { useUiStore, type ColorMode, type Locale } from '@/stores/ui';

const auth = useAuthStore();
const ui = useUiStore();
const { user, isLoggedIn } = storeToRefs(auth);
const { locale, colorMode } = storeToRefs(ui);
const { t } = useI18n();
const route = useRoute();

const locales: { value: Locale; label: string }[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];
const colorModes: ColorMode[] = ['system', 'light', 'dark'];
</script>

<template>
  <header class="app-header">
    <RouterLink to="/" class="app-brand"><i class="pi pi-lock" /> {{ t('app.title') }}</RouterLink>
    <nav class="app-toolbar">
      <RouterLink :to="{ name: 'rooms' }">{{ t('app.rooms') }}</RouterLink>
      <RouterLink :to="{ name: 'room-create' }">{{ t('app.newRoom') }}</RouterLink>
    </nav>
    <span class="app-spacer" />
    <Select
      v-model="locale"
      :options="locales"
      option-label="label"
      option-value="value"
      size="small"
      :aria-label="t('app.language')"
      data-testid="locale-select"
    />
    <Select
      v-model="colorMode"
      :options="colorModes"
      :option-label="(mode: ColorMode) => t(`app.colorMode.${mode}`)"
      size="small"
      :aria-label="t('app.colorModeLabel')"
    />
    <template v-if="isLoggedIn">
      <span data-testid="current-user">{{ user?.name }}</span>
      <Button :label="t('app.logout')" icon="pi pi-sign-out" size="small" text @click="auth.logout()" />
    </template>
    <Button
      v-else
      :label="t('app.login')"
      icon="pi pi-discord"
      size="small"
      data-testid="login-button"
      @click="auth.login(route.fullPath)"
    />
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.app-brand {
  font-weight: 700;
  font-size: 1.125rem;
  text-decoration: none;
}
</style>
