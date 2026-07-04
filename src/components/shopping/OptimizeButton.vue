<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useOptimization } from '@/composables/useOptimization'
import { useShoppingListStore } from '@/stores/shoppingList'
import { formatPrice } from '@/utils/format'

/**
 * Persistent "Einkaufsliste optimieren" button.
 *
 * Triggers the optimization engine which compares every product on the list
 * against cheaper alternatives across all selected supermarkets. Shows a
 * loading state and, once finished, the number of alternatives found.
 */
const { isOptimizing, alternativesFound, optimize } = useOptimization()
const listStore = useShoppingListStore()

/** Whether there are any product items to optimize. */
const hasProducts = computed(() => listStore.items.some((i) => i.type === 'product'))

/**
 * Total savings across all items that have a cheaper alternative.
 * @type {import('vue').ComputedRef<number>}
 */
const totalSavings = computed(() =>
  listStore.items.reduce((sum, item) => sum + (item.optimization?.alternative?.savings ?? 0), 0),
)
</script>

<template>
  <div class="sticky bottom-4 z-10 space-y-1">
    <button
      class="btn btn-primary btn-block shadow-lg gap-2"
      :disabled="isOptimizing || !hasProducts"
      @click="optimize"
    >
      <span v-if="isOptimizing" class="loading loading-spinner loading-sm" />
      <Icon v-else icon="lucide:sparkles" width="20" height="20" />
      <span>Einkaufsliste optimieren</span>
      <span v-if="!isOptimizing && alternativesFound > 0" class="badge badge-success badge-sm">
        {{ alternativesFound }}
      </span>
    </button>
    <p v-if="!isOptimizing && alternativesFound > 0" class="text-center text-xs text-success">
      {{ alternativesFound }} günstigere Alternativen gefunden – spare
      {{ formatPrice(totalSavings) }}!
    </p>
  </div>
</template>
