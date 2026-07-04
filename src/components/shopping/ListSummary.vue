<script setup>
import { computed } from 'vue'
import { useShoppingListStore } from '@/stores/shoppingList'
import { formatPrice } from '@/utils/format'

/**
 * Compact summary bar showing the total price and the number of items on the
 * shopping list. Displayed above the grouped list.
 */
const listStore = useShoppingListStore()

/** @type {import('vue').ComputedRef<number>} Total retail price in cents. */
const total = computed(() => listStore.totalPrice)
/** @type {import('vue').ComputedRef<number>} Number of items. */
const count = computed(() => listStore.itemCount)
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
      <div class="stat-desc">{{ checked }} erledigt</div>
    </div>
  </div>
</template>
