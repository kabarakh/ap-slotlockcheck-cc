<script setup lang="ts">
const props = defineProps<{ count: number; names: string[] }>();
</script>

<template>
  <span class="slot-name-list">
    <span class="slot-name-count">{{ props.count }}</span>
    <span v-if="props.names.length > 0" class="app-muted slot-names">{{ props.names.join(', ') }}</span>
  </span>
</template>

<style scoped>
.slot-name-list {
  display: flex;
  flex-direction: column;
}

.slot-name-count {
  font-weight: 600;
}

.slot-names {
  font-size: 0.75rem;
}
</style>
