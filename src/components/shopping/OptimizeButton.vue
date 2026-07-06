<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useShoppingListStore } from '@/stores/shoppingList'

/**
 * Persistent "Einkaufsliste optimieren" button.
 *
 * Pure trigger button without any optimization logic. Emits `optimize` when
 * clicked so the parent can wire up the actual behaviour later.
 */
const emit = defineEmits(['optimize'])
const listStore = useShoppingListStore()

/** Whether there are any product items to optimize. */
const hasProducts = computed(() => listStore.items.some((i) => i.type === 'product'))
</script>

<template>
  <div class="sticky bottom-4 z-10">
    <button
      class="btn btn-primary btn-block shadow-lg gap-2"
      :disabled="!hasProducts"
      @click="emit('optimize')"
    >
      <Icon icon="lucide:sparkles" width="20" height="20" />
      <span>Einkaufsliste optimieren</span>
    </button>
  </div>
</template>
