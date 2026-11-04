<script setup lang="ts">
const props = defineProps<{ facts: { key: string; label: string; value: string }[] }>();
</script>

<template>
  <dl class="statistic-facts">
    <div v-for="fact in props.facts" :key="fact.key" class="statistic-fact" :data-testid="`fact-${fact.key}`">
      <dt class="app-muted">{{ fact.label }}</dt>
      <dd>{{ fact.value }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.statistic-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 0;
}

.statistic-fact dt {
  font-size: 0.8125rem;
}

.statistic-fact dd {
  margin: 0;
  font-weight: 700;
  font-size: 1.125rem;
}
</style>
