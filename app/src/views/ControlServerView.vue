<script setup lang="ts">
import ServerCommandsPanel from '@/components/admin/ServerCommandsPanel.vue';
import ServerConnectionPanel from '@/components/admin/ServerConnectionPanel.vue';
import ServerJobProgress from '@/components/admin/ServerJobProgress.vue';
</script>

<template>
  <ServerConnectionPanel />
  <ServerJobProgress />
  <ServerCommandsPanel />
</template>
