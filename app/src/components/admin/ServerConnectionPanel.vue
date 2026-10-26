<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Password from 'primevue/password';
import Select from 'primevue/select';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useServerAdminStore } from '@/stores/server-admin';

const serverAdmin = useServerAdminStore();
const { status, loginDraft, loggedIn, busy } = storeToRefs(serverAdmin);
const { selectedLockers, slotById } = storeToRefs(useCurrentRoomStore());
const { t } = useI18n();

const lockerOptions = computed(() =>
  selectedLockers.value.map((slot) => ({ value: slot.id, label: `#${slot.position} ${slot.name}` })),
);
const connectedSlotName = computed(() => slotById.value.get(status.value?.slotId ?? -1)?.name ?? '');

onMounted(() => serverAdmin.fetchStatus());
</script>

<template>
  <section class="app-form">
    <h2>{{ t('server.title') }}</h2>
    <p class="app-muted">{{ t('server.intro') }}</p>
    <Message severity="warn" :closable="false">{{ t('server.chatHint') }}</Message>
    <template v-if="loggedIn">
      <p data-testid="server-status">{{ t('server.loggedInAs', { slot: connectedSlotName }) }}</p>
      <div class="app-toolbar">
        <Button
          :label="t('server.logout')"
          severity="secondary"
          size="small"
          :loading="busy"
          data-testid="server-logout"
          @click="serverAdmin.logout()"
        />
      </div>
    </template>
    <form v-else class="app-form" autocomplete="off" @submit.prevent="serverAdmin.login()">
      <label v-if="lockerOptions.length > 1" class="app-field">
        {{ t('server.slotLockSlot') }}
        <Select
          v-model="loginDraft.slotId"
          :options="lockerOptions"
          option-label="label"
          option-value="value"
          data-testid="server-slot"
        />
      </label>
      <label class="app-field">
        {{ t('server.serverPassword') }}
        <Password v-model="loginDraft.serverPassword" :feedback="false" toggle-mask input-id="server-password" />
        <span class="app-muted">{{ t('server.serverPasswordHint') }}</span>
      </label>
      <label class="app-field">
        {{ t('server.roomPassword') }}
        <Password v-model="loginDraft.roomPassword" :feedback="false" toggle-mask input-id="room-password" />
      </label>
      <p class="app-muted">{{ t('server.memoryHint') }}</p>
      <div class="app-toolbar">
        <Button
          type="submit"
          :label="t('server.login')"
          :disabled="loginDraft.serverPassword.length === 0"
          :loading="busy"
          data-testid="server-login"
        />
      </div>
    </form>
  </section>
</template>
