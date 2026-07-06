<script setup>
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useShoppingListStore } from '@/stores/shoppingList'
import { useShoppingTime } from '@/composables/useShoppingTime'
import { useOptimization } from '@/composables/useOptimization'
import { formatDuration } from '@/utils/format'
import { supermarketLabel } from '@/utils/supermarkets'
import ShoppingListItem from './ShoppingListItem.vue'
import OptimizationDialog from './OptimizationDialog.vue'

/**
 * Renders the shopping list grouped by supermarket. Each group is a DaisyUI
 * `collapse` so the user can fold/unfold individual supermarkets. Items that
 * are raw text entries are collected under a "Sonstiges" group.
 *
 * Each group header shows the estimated stay duration (computed by the
 * shared `useShoppingTime` composable) next to the item count.
 *
 * A single shared `OptimizationDialog` is mounted here and opened whenever a
 * `ShoppingListItem` emits `open-optimization`. When the user selects an
 * alternative, the dialog calls `listStore.replaceItem` and the
 * `replaced` event clears the optimization result for that item so the
 * badge disappears.
 */
const listStore = useShoppingListStore()
const { groupTimes } = useShoppingTime()
const { rejectSuggestion } = useOptimization()

/** @type {import('vue').ComputedRef<object[]>} Groups of items by supermarket. */
const groups = computed(() => listStore.groupedItems)

/**
 * Currently open optimization dialog payload: the item being optimized and
 * its `OptimizationResult`. `null` when the dialog is closed.
 * @type {import('vue').Ref<{item: object, result: object}|null>}
 */
const openOpt = ref(null)

/** @type {import('vue').ComputedRef<boolean>} Whether the optimization dialog is open. */
const optDialogOpen = computed(() => openOpt.value !== null)

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

/**
 * Open the optimization dialog for a given item + result payload.
 * @param {{item: object, result: object}} payload
 */
function openOptimization(payload) {
  openOpt.value = payload
}

/** Close the optimization dialog. */
function closeOptimization() {
  openOpt.value = null
}

/**
 * Handle a successful replacement: clear the optimization result for the
 * item (so the badge disappears) and close the dialog.
 * @param {string} uid - The replaced item's uid.
 */
function onReplaced(uid) {
  rejectSuggestion(uid)
  openOpt.value = null
}

/**
 * Handle a rejection: dismiss the optimization result for the item so the
 * badge disappears from the list, then close the dialog.
 * @param {string} uid - The rejected item's uid.
 */
function onRejected(uid) {
  rejectSuggestion(uid)
  openOpt.value = null
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
          <ShoppingListItem
            v-for="item in group.items"
            :key="item.uid"
            :item="item"
            @open-optimization="openOptimization"
          />
        </ul>
      </div>
    </div>
  </div>

  <!-- Shared optimization selection dialog -->
  <OptimizationDialog
    :open="optDialogOpen"
    :result="openOpt?.result ?? null"
    :item="openOpt?.item ?? null"
    @close="closeOptimization"
    @replaced="onReplaced"
    @rejected="onRejected"
  />
</template>
