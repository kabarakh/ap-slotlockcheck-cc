<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';

import { useInvitationsStore } from '@/stores/invitations';

const invitations = useInvitationsStore();
const { state } = storeToRefs(invitations);
const { t } = useI18n();
const route = useRoute();
const router = useRouter();

onMounted(async () => {
  const slug = await invitations.accept(String(route.params['token'] ?? ''));
  if (slug) {
    await router.replace({ name: 'admin', params: { slug } });
  }
});
</script>

<template>
  <ProgressSpinner v-if="state === 'accepting'" />
  <Message v-else-if="state === 'failed'" severity="error">
    {{ t('invitations.failed') }} <RouterLink :to="{ name: 'rooms' }">{{ t('app.rooms') }}</RouterLink>
  </Message>
</template>
