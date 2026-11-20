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
const { locale, colorMode, isDark } = storeToRefs(ui);
const { t } = useI18n();
const route = useRoute();

const locales: { value: Locale; label: string }[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
];
const colorModes: ColorMode[] = ['system', 'light', 'dark'];
const longTitle = ['Tracking', 'Opened', 'Archipelago', 'Slotlocks', 'Together'];
</script>

<template>
  <header class="app-header">
    <RouterLink to="/" class="app-brand">
      <img :src="isDark ? '/logo-dark.svg' : '/logo.svg'" alt="" class="app-logo" width="28" height="28" />
      <span class="app-brand-short">{{ t('app.title') }}</span>
      <span class="app-brand-long" data-testid="brand-long">
        <template v-for="(word, index) in longTitle" :key="word"
          >{{ index > 0 ? ' ' : '' }}<span class="app-brand-initial">{{ word[0] }}</span
          >{{ word.slice(1) }}</template
        >
      </span>
    </RouterLink>
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
  container-type: inline-size;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.app-logo {
  display: block;
}

.app-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 1.125rem;
  text-decoration: none;
}

.app-brand-long {
  display: none;
  font-weight: 500;
}

.app-brand-initial {
  font-weight: 800;
  color: var(--p-primary-color);
}

@container (min-width: 75rem) {
  .app-brand-short {
    display: none;
  }

  .app-brand-long {
    display: inline;
  }
}
</style>
