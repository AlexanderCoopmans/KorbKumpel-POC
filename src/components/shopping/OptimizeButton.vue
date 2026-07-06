<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useShoppingListStore } from '@/stores/shoppingList'
import { useOptimization } from '@/composables/useOptimization'

/**
 * Persistent "Einkaufsliste optimieren" button.
 *
 * Triggers the AI-driven optimization run via the shared `useOptimization`
 * composable. While a run is in progress the button is disabled and shows a
 * loading spinner. The per-item results are rendered as badges/tags inside
 * the shopping list rows.
 */
const listStore = useShoppingListStore()
const { isLoading, runOptimization } = useOptimization()

/** Whether there are any items to optimize. */
const hasItems = computed(() => listStore.items.length > 0)
</script>

<template>
  <div class="sticky bottom-4 z-10">
    <button
      class="btn btn-primary btn-block shadow-lg gap-2"
      :disabled="!hasItems || isLoading"
      @click="runOptimization"
    >
      <span v-if="isLoading" class="loading loading-spinner loading-sm" />
      <Icon v-else icon="lucide:sparkles" width="20" height="20" />
      <span>{{ isLoading ? 'Optimiere...' : 'Einkaufsliste optimieren' }}</span>
    </button>
  </div>
</template>
