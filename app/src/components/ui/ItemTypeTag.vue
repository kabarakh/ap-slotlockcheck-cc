<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import Tag from 'primevue/tag';

import type { ItemType } from '@/api/types';
import { ITEM_TYPE_SEVERITY } from '@/domain/item-type';

const props = defineProps<{ itemType: ItemType }>();
const { t } = useI18n();
</script>

<template>
  <Tag :severity="ITEM_TYPE_SEVERITY[props.itemType]" :value="t(`itemTypes.${props.itemType}`)" />
</template>
