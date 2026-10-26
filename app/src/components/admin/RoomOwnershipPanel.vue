<script setup lang="ts">
import { onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';

import { useAdminStore } from '@/stores/admin';
import { useCurrentRoomStore } from '@/stores/current-room';
import { useRoomOwnershipStore } from '@/stores/room-ownership';

const ownership = useRoomOwnershipStore();
const { transferDraft, deleteTitle, confirming, busy, transferOptions, canDelete } = storeToRefs(ownership);
const roomStore = useCurrentRoomStore();
const { room, membership, isAdmin } = storeToRefs(roomStore);
const router = useRouter();
const { t } = useI18n();

const leave = async () => {
  const slug = room.value?.slug;
  if ((await ownership.leave()) && slug) {
    await router.push({ name: 'roster', params: { slug } });
  }
};

const deleteRoom = async () => {
  if (await ownership.deleteRoom()) {
    await router.push({ name: 'rooms' });
  }
};

onMounted(() => {
  if (isAdmin.value && useAdminStore().admins.length === 0) {
    void useAdminStore().load();
  }
});
</script>

<template>
  <section class="ownership">
    <template v-if="membership.isOwner">
      <form class="app-form" @submit.prevent="ownership.ask('transfer')">
        <h2>{{ t('ownership.transferTitle') }}</h2>
        <p class="app-muted">{{ t('ownership.transferIntro') }}</p>
        <label class="app-field">
          {{ t('ownership.newOwner') }}
          <Select
            v-model="transferDraft.discordId"
            :options="transferOptions"
            option-label="name"
            option-value="discordId"
            filter
            data-testid="new-owner"
          />
        </label>
        <label class="app-toolbar">
          <Checkbox v-model="transferDraft.stayAdmin" binary data-testid="stay-admin" />
          {{ t('ownership.stayAdmin') }}
        </label>
        <div class="app-toolbar">
          <Button
            type="submit"
            :label="t('ownership.transfer')"
            :disabled="!transferDraft.discordId || busy"
            data-testid="transfer-owner"
          />
        </div>
        <Message v-if="confirming === 'transfer'" severity="warn" :closable="false">
          <p>
            {{ transferDraft.stayAdmin ? t('ownership.confirmTransferStay') : t('ownership.confirmTransferLeave') }}
          </p>
          <div class="app-toolbar">
            <Button
              :label="t('ownership.confirm')"
              severity="danger"
              size="small"
              :loading="busy"
              data-testid="confirm-transfer"
              @click="ownership.transfer()"
            />
            <Button :label="t('common.cancel')" size="small" text @click="ownership.cancel()" />
          </div>
        </Message>
      </form>

      <form class="app-form" @submit.prevent="deleteRoom()">
        <h2>{{ t('ownership.deleteTitle') }}</h2>
        <p class="app-muted">{{ t('ownership.deleteIntro', { title: room?.title ?? '' }) }}</p>
        <InputText v-model="deleteTitle" :placeholder="room?.title" data-testid="delete-title" />
        <div class="app-toolbar">
          <Button
            type="submit"
            :label="t('ownership.delete')"
            severity="danger"
            :disabled="!canDelete || busy"
            data-testid="delete-room"
          />
        </div>
      </form>
    </template>

    <section v-else class="app-form">
      <h2>{{ t('ownership.leaveTitle') }}</h2>
      <p class="app-muted">{{ t('ownership.leaveIntro') }}</p>
      <div class="app-toolbar">
        <Button
          :label="t('ownership.leave')"
          severity="danger"
          :disabled="busy"
          data-testid="leave-room"
          @click="ownership.ask('leave')"
        />
      </div>
      <Message v-if="confirming === 'leave'" severity="warn" :closable="false">
        <p>{{ t('ownership.confirmLeave') }}</p>
        <div class="app-toolbar">
          <Button
            :label="t('ownership.confirm')"
            severity="danger"
            size="small"
            :loading="busy"
            data-testid="confirm-leave"
            @click="leave()"
          />
          <Button :label="t('common.cancel')" size="small" text @click="ownership.cancel()" />
        </div>
      </Message>
    </section>
  </section>
</template>

<style scoped>
.ownership {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
</style>
