<script setup>
import { computed } from 'vue'
import { useShoppingListStore } from '@/stores/shoppingList'
import { useShoppingTime } from '@/composables/useShoppingTime'
import { formatPrice, formatDuration } from '@/utils/format'

/**
 * Compact summary bar showing the total price, the number of items on the
 * shopping list and the estimated total time needed for the shopping trip.
 *
 * The time calculation (driving + per-store stays + raw items) is shared
 * via the `useShoppingTime` composable so it stays consistent with the
 * per-group durations shown in `GroupedList`.
 *
 * Displayed above the grouped list.
 */
const listStore = useShoppingListStore()
const { totalTime, includesDriving } = useShoppingTime()

/** @type {import('vue').ComputedRef<number>} Total retail price in cents. */
const total = computed(() => listStore.totalPrice)
/** @type {import('vue').ComputedRef<number>} Number of items. */
const count = computed(() => listStore.itemCount)
/** @type {import('vue').ComputedRef<number>} Sum of all item quantities. */
const quantity = computed(() => listStore.totalQuantity)
/** @type {import('vue').ComputedRef<number>} Number of checked items. */
const checked = computed(() => listStore.checkedCount)
</script>

<template>
  <div class="stats stats-horizontal shadow w-full bg-base-100">
    <div class="stat">
      <div class="stat-title">Gesamt</div>
      <div class="stat-value text-primary text-lg">{{ formatPrice(total) }}</div>
    </div>
    <div class="stat">
      <div class="stat-title">Artikel</div>
      <div class="stat-value text-lg">{{ count }}</div>
      <div class="stat-desc">{{ quantity }} Stück · {{ checked }} erledigt</div>
    </div>
    <div class="stat">
      <div class="stat-title">Dauer</div>
      <div class="stat-value text-lg">{{ formatDuration(totalTime) }}</div>
      <div class="stat-desc">{{ includesDriving ? 'Fahrt + Aufenthalt' : 'nur Aufenthalt' }}</div>
    </div>
  </div>
</template>
