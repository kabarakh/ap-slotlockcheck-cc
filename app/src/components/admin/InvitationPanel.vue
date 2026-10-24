<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import DateTimeText from '@/components/ui/DateTimeText.vue';
import { useInvitationsStore } from '@/stores/invitations';

const invitations = useInvitationsStore();
const { createdUrl, createdValidUntil } = storeToRefs(invitations);
const { t } = useI18n();
</script>

<template>
  <section class="app-form invitation">
    <h3>{{ t('invitations.title') }}</h3>
    <p class="app-muted">{{ t('invitations.intro') }}</p>
    <div class="app-toolbar">
      <Button :label="t('invitations.create')" icon="pi pi-link" size="small" @click="invitations.create()" />
    </div>
    <template v-if="createdUrl">
      <div class="app-toolbar">
        <InputText :model-value="createdUrl" readonly class="invitation-url" data-testid="invitation-url" />
        <Button
          icon="pi pi-copy"
          size="small"
          text
          :aria-label="t('invitations.copy')"
          @click="invitations.copyCreatedUrl()"
        />
      </div>
      <span class="app-muted">{{ t('invitations.validUntil') }} <DateTimeText :value="createdValidUntil" /></span>
    </template>
  </section>
</template>

<style scoped>
.invitation {
  margin-top: 1.5rem;
}

.invitation-url {
  min-width: 28rem;
}
</style>
