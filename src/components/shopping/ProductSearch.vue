<script setup>
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useProductSearch } from '@/composables/useProductSearch'
import { useMarketStore } from '@/stores/market'
import { useShoppingListStore } from '@/stores/shoppingList'
import { formatPrice, formatBasePrice } from '@/utils/format'
import { supermarketLabel } from '@/utils/supermarkets'

/**
 * Smart incremental search input.
 *
 * - Fires debounced Typesense queries as the user types.
 * - The very first suggestion is always a raw text fallback matching the
 *   typed query.
 * - Results are sorted by `basePrice` ascending (cheapest first).
 * - Selecting a product adds it to the shopping list; selecting the raw
 *   fallback adds a plain text item.
 * - A quantity input left of the search field lets the user pick how many
 *   of the selected product should be added. The quantity resets to 1
 *   after every submission.
 */
const { searchQuery, suggestions, isLoading, error } = useProductSearch()
const listStore = useShoppingListStore()
const marketStore = useMarketStore()

/** Whether the supermarket filter is active. */
const hasFilter = computed(() => marketStore.hasSelection)

/**
 * Quantity to apply to the next selected product. Defaults to 1 and is
 * reset to 1 after every submission.
 * @type {import('vue').Ref<number>}
 */
const quantity = ref(1)

/**
 * Handle a suggestion click: add the item to the list with the current
 * quantity and reset the input and quantity.
 * @param {object} suggestion - The selected suggestion.
 */
function selectSuggestion(suggestion) {
  const qty = Math.max(1, Math.floor(Number(quantity.value) || 1))
  if (suggestion.type === 'raw') {
    listStore.addRawItem(suggestion.name, qty)
  } else if (suggestion.type === 'product' && suggestion.product) {
    listStore.addProduct(suggestion.product, qty)
  }
  searchQuery.value = ''
  quantity.value = 1
}
</script>

<template>
  <div class="w-full space-y-2">
    <label class="label">
      <span class="label-text font-medium">Produkt suchen</span>
    </label>
    <div class="flex items-center gap-2">
      <!-- Quantity input (left of the search field) -->
      <input
        v-model.number="quantity"
        type="number"
        min="1"
        class="input input-bordered w-16 text-center shrink-0 px-1"
        aria-label="Menge"
      />
      <!-- Search input -->
      <div class="relative flex-1 min-w-0">
        <input
          v-model="searchQuery"
          type="text"
          class="input input-bordered w-full pr-10"
          :class="{ 'input-error': error }"
          placeholder="Produkt suchen und hinzufügen..."
        />
        <span
          v-if="isLoading"
          class="loading loading-spinner loading-sm absolute right-3 top-1/2 -translate-y-1/2"
        />
      </div>
    </div>

    <p v-if="!hasFilter" class="text-xs text-warning flex items-center gap-1">
      <Icon icon="lucide:triangle-alert" width="14" height="14" />
      Keine Supermärkte ausgewählt – bitte zuerst Supermärkte konfigurieren.
    </p>
    <p v-if="error" class="text-xs text-error">{{ error }}</p>

    <ul
      v-if="suggestions.length > 0"
      v-auto-animate
      class="bg-base-100 rounded-box border border-base-300 shadow-lg max-h-80 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-1"
    >
      <li v-for="(suggestion, index) in suggestions" :key="index" class="list-none">
        <button
          type="button"
          class="flex items-center gap-3 w-full text-left"
          @click="selectSuggestion(suggestion)"
        >
          <!-- Raw text fallback -->
          <template v-if="suggestion.type === 'raw'">
            <span class="badge badge-ghost badge-sm">Text</span>
            <span class="flex-1 truncate">{{ suggestion.name }}</span>
          </template>

          <!-- Product suggestion -->
          <template v-else-if="suggestion.product">
            <div class="avatar avatar-placeholder">
              <div class="w-10 rounded">
                <img
                  v-if="suggestion.product.imageUrl"
                  :src="suggestion.product.imageUrl"
                  :alt="suggestion.product.name"
                  loading="lazy"
                />
                <Icon
                  v-else
                  icon="lucide:shopping-cart"
                  width="20"
                  height="20"
                  class="text-base-content/40"
                />
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <p class="truncate font-medium">{{ suggestion.product.name }}</p>
              <p class="text-xs text-base-content/60 truncate">
                {{ suggestion.product.brand || '—' }} ·
                {{ supermarketLabel(suggestion.product.supermarket) }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-sm font-semibold">{{ formatPrice(suggestion.product.retailPrice) }}</p>
              <p class="text-xs text-base-content/60">
                {{ formatBasePrice(suggestion.product.basePrice, suggestion.product.baseUnit) }}
              </p>
            </div>
          </template>
        </button>
      </li>
    </ul>
  </div>
</template>
