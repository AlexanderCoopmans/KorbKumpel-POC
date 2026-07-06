<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useShoppingListStore } from '@/stores/shoppingList'
import { useShoppingTime } from '@/composables/useShoppingTime'
import { formatDuration } from '@/utils/format'
import { supermarketLabel } from '@/utils/supermarkets'
import ShoppingListItem from './ShoppingListItem.vue'

/**
 * Renders the shopping list grouped by supermarket. Each group is a DaisyUI
 * `collapse` so the user can fold/unfold individual supermarkets. Items that
 * are raw text entries are collected under a "Sonstiges" group.
 *
 * Each group header shows the estimated stay duration (computed by the
 * shared `useShoppingTime` composable) next to the item count.
 */
const listStore = useShoppingListStore()
const { groupTimes } = useShoppingTime()

/** @type {import('vue').ComputedRef<object[]>} Groups of items by supermarket. */
const groups = computed(() => listStore.groupedItems)

/**
 * Resolve a group key to a human friendly label.
 * @param {string} key - The supermarket id or `__raw__`.
 */
function groupLabel(key) {
  return key === '__raw__' ? 'Sonstiges' : supermarketLabel(key)
}

/**
 * Estimated stay duration for a given group key, in seconds.
 * @param {string} key - The supermarket id or `__raw__`.
 * @returns {number}
 */
function groupDuration(key) {
  return groupTimes.value[key] ?? 0
}
</script>

<template>
  <div
    v-if="groups.length === 0"
    class="text-center text-base-content/60 py-16 flex flex-col items-center gap-3"
  >
    <Icon icon="lucide:shopping-cart" width="48" height="48" class="text-base-content/30" />
    <div class="space-y-1">
      <p class="font-medium">Deine Einkaufsliste ist noch leer.</p>
      <p class="text-sm">Suche oben nach Produkten, um loszulegen.</p>
    </div>
  </div>

  <div v-else class="flex flex-col gap-4">
    <div
      v-for="group in groups"
      :key="group.supermarket"
      class="collapse collapse-arrow border border-base-300 rounded-box bg-base-100"
    >
      <input type="checkbox" checked />
      <div class="collapse-title font-semibold flex items-center justify-between">
        <span>{{ groupLabel(group.supermarket) }}</span>
        <span class="flex items-center gap-2">
          <span class="badge badge-ghost badge-sm gap-1">
            <Icon icon="lucide:clock" width="12" height="12" />
            {{ formatDuration(groupDuration(group.supermarket)) }}
          </span>
          <span class="badge badge-ghost badge-sm">{{ group.items.length }}</span>
        </span>
      </div>
      <div class="collapse-content overflow-hidden">
        <ul v-auto-animate class="list bg-transparent px-0 gap-2 min-w-0">
          <ShoppingListItem v-for="item in group.items" :key="item.uid" :item="item" />
        </ul>
      </div>
    </div>
  </div>
</template>
