<script setup lang="ts">
const props = defineProps<{ title: string; info?: string; testId: string }>();
</script>

<template>
  <section class="statistic-section" :data-testid="props.testId">
    <header class="statistic-header">
      <h2>{{ props.title }}</h2>
      <span
        v-if="props.info"
        v-tooltip.top="props.info"
        class="pi pi-info-circle statistic-info"
        role="img"
        :aria-label="props.info"
        tabindex="0"
        data-testid="statistic-info"
      />
      <span class="app-spacer" />
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>

<style scoped>
.statistic-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: var(--p-content-border-radius);
  background: var(--p-content-background);
  min-width: 0;
}

.statistic-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.statistic-header h2 {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
}

.statistic-info {
  color: var(--p-text-muted-color);
  font-size: 0.875rem;
  cursor: help;
}
</style>
