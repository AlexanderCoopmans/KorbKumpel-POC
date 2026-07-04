<script setup>
import { computed } from 'vue'
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
 */
const { searchQuery, suggestions, isLoading, error } = useProductSearch()
const listStore = useShoppingListStore()
const marketStore = useMarketStore()

/** Whether the supermarket filter is active. */
const hasFilter = computed(() => marketStore.hasSelection)

/**
 * Handle a suggestion click: add the item to the list and reset the input.
 * @param {object} suggestion - The selected suggestion.
 */
function selectSuggestion(suggestion) {
  if (suggestion.type === 'raw') {
    listStore.addRawItem(suggestion.name)
  } else if (suggestion.type === 'product' && suggestion.product) {
    listStore.addProduct(suggestion.product)
  }
  searchQuery.value = ''
}
</script>

<template>
  <div class="w-full space-y-2">
    <label class="label">
      <span class="label-text font-medium">Produkt suchen</span>
    </label>
    <div class="relative">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="z. B. Schokolade"
        class="input input-bordered w-full pr-10"
        :class="{ 'input-error': error }"
      />
      <span
        v-if="isLoading"
        class="loading loading-spinner loading-sm absolute right-3 top-1/2 -translate-y-1/2"
      />
    </div>

    <p v-if="!hasFilter" class="text-xs text-warning flex items-center gap-1">
      <Icon icon="lucide:triangle-alert" width="14" height="14" />
      Keine Supermärkte ausgewählt – bitte zuerst Supermärkte konfigurieren.
    </p>
    <p v-if="error" class="text-xs text-error">{{ error }}</p>

    <ul
      v-if="suggestions.length > 0"
      v-auto-animate
      class="menu bg-base-100 rounded-box border border-base-300 shadow-lg max-h-80 overflow-y-auto p-2"
    >
      <li v-for="(suggestion, index) in suggestions" :key="index">
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
