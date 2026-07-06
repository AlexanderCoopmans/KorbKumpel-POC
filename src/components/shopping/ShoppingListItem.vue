<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useShoppingListStore } from '@/stores/shoppingList'
import { useOptimization } from '@/composables/useOptimization'
import { formatPrice, formatBasePrice } from '@/utils/format'
import { supermarketLabel } from '@/utils/supermarkets'
import OptimizationBadge from './OptimizationBadge.vue'

/**
 * Single shopping list item row.
 *
 * Displays the product (or raw text) with a checkbox to mark it as bought
 * and a delete button. When an optimization result is available for this
 * item (see `useOptimization`), an inline badge/tag is rendered:
 *
 * - **"Other" flow:** a tag between the product name and the delete icon
 *   showing the cheapest match found.
 * - **"Price" flow:** a savings badge to the left of the current price.
 *
 * Clicking either badge emits `open-optimization` with the item and result
 * so the parent can open the shared `OptimizationDialog`.
 *
 * @prop {object} item - The shopping list item to render.
 */
const props = defineProps({
  item: { type: Object, required: true },
})

const emit = defineEmits(['open-optimization'])

const listStore = useShoppingListStore()
const { getResult } = useOptimization()

/** @type {import('vue').ComputedRef<object|null>} Optimization result for this item. */
const optResult = computed(() => getResult(props.item.uid))

/** @type {import('vue').ComputedRef<'other'|'price'|null>} Flow kind, or null. */
const optKind = computed(() => optResult.value?.kind ?? null)

/**
 * Open the optimization dialog for this item.
 */
function openOptimization() {
  if (optResult.value) {
    emit('open-optimization', { item: props.item, result: optResult.value })
  }
}
</script>

<template>
  <li
    class="rounded-box bg-base-100 hover:bg-base-200/50 transition-colors p-3 overflow-hidden min-w-0 w-full"
  >
    <div class="flex items-center gap-2 sm:gap-3 min-w-0">
      <!-- Checkbox to mark item as bought -->
      <input
        type="checkbox"
        class="checkbox checkbox-primary shrink-0"
        :checked="item.checked"
        @change="listStore.toggleChecked(item.uid)"
      />

      <!-- Quantity input (left of the name) -->
      <input
        type="number"
        min="1"
        class="input input-bordered input-xs w-12 text-center shrink-0 px-1"
        :value="item.quantity ?? 1"
        aria-label="Menge"
        @change="listStore.setQuantity(item.uid, Number($event.target.value))"
      />

      <!-- Product image / placeholder -->
      <div class="avatar avatar-placeholder shrink-0">
        <div
          class="w-9 h-9 sm:w-11 sm:h-11 rounded-lg bg-base-200 grid place-items-center overflow-hidden"
        >
          <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" loading="lazy" />
          <Icon
            v-else
            icon="lucide:shopping-cart"
            width="100%"
            height="100%"
            class="text-base-content/40"
          />
        </div>
      </div>

      <!-- Name + meta -->
      <div class="flex-1 min-w-0 overflow-hidden">
        <p
          class="font-medium leading-tight truncate"
          :class="{ 'line-through text-base-content/50': item.checked }"
        >
          {{ item.name }}
        </p>
        <p class="text-xs text-base-content/60 truncate mt-0.5">
          <template v-if="item.type === 'product'">
            {{ item.brand || '—' }} · {{ supermarketLabel(item.supermarket) }}
          </template>
          <template v-else>Eigener Eintrag</template>
        </p>
      </div>

      <!-- "Other" optimization tag (between name and price/delete) -->
      <OptimizationBadge
        v-if="optKind === 'other'"
        kind="other"
        :result="optResult"
        @open="openOptimization"
      />

      <!-- Price -->
      <div class="text-right shrink-0 min-w-0 flex items-center gap-2">
        <!-- "Price" optimization savings badge (left of the current price) -->
        <OptimizationBadge
          v-if="optKind === 'price'"
          kind="price"
          :result="optResult"
          @open="openOptimization"
        />
        <div>
          <p v-if="item.retailPrice != null" class="font-semibold leading-tight whitespace-nowrap">
            {{ formatPrice(item.retailPrice * (item.quantity ?? 1)) }}
          </p>
          <p
            v-if="item.basePrice != null"
            class="text-xs text-base-content/60 mt-0.5 whitespace-nowrap"
          >
            {{ formatBasePrice(item.basePrice, item.baseUnit) }}
          </p>
        </div>
      </div>

      <!-- Delete -->
      <button
        class="btn btn-ghost btn-circle btn-sm text-base-content/40 hover:text-error shrink-0 p-1"
        aria-label="Eintrag löschen"
        @click="listStore.removeItem(item.uid)"
      >
        <Icon icon="lucide:trash-2" />
      </button>
    </div>
  </li>
</template>
