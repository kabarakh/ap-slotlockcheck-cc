<script setup lang="ts">
const props = defineProps<{ title: string; hints?: string[]; testId: string }>();
</script>

<template>
  <section class="statistic-section" :data-testid="props.testId">
    <h2>{{ props.title }}</h2>
    <p v-for="hint in props.hints ?? []" :key="hint" class="app-muted statistic-hint">{{ hint }}</p>
    <slot />
  </section>
</template>

<style scoped>
.statistic-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: var(--app-gap);
  border: 1px solid var(--p-content-border-color);
  border-radius: var(--p-content-border-radius);
  background: var(--p-content-background);
  min-width: 0;
}

.statistic-section h2 {
  margin: 0;
  font-size: 1.125rem;
}

.statistic-hint {
  margin: 0;
  font-size: 0.875rem;
}
</style>
