<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useShoppingListStore } from '@/stores/shoppingList'
import { formatPrice, formatBasePrice } from '@/utils/format'
import { supermarketLabel } from '@/utils/supermarkets'

/**
 * Single shopping list item row.
 *
 * Displays the product (or raw text) with a checkbox to mark it as bought
 * and a delete button. When an optimization result is present, a savings
 * callout with a side-by-side comparison and an "Übernehmen" (swap) button
 * is shown.
 *
 * @prop {object} item - The shopping list item to render.
 */
const props = defineProps({
  item: { type: Object, required: true },
})

const listStore = useShoppingListStore()

/** @type {import('vue').ComputedRef<boolean>} Whether a cheaper alternative exists. */
const hasAlternative = computed(() => props.item.optimization?.hasAlternative === true)

/** @type {import('vue').ComputedRef<object|null>} The alternative product. */
const alternative = computed(() => props.item.optimization?.alternative ?? null)

/**
 * Replace the current item with the cheaper alternative.
 */
function swap() {
  if (!alternative.value) return
  listStore.swapItem(props.item.uid, alternative.value)
}
</script>

<template>
  <li class="rounded-box bg-base-100 hover:bg-base-200/50 transition-colors p-3">
    <div class="flex items-center gap-3">
      <!-- Checkbox to mark item as bought -->
      <input
        type="checkbox"
        class="checkbox checkbox-primary shrink-0"
        :checked="item.checked"
        @change="listStore.toggleChecked(item.uid)"
      />

      <!-- Product image / placeholder -->
      <div class="avatar avatar-placeholder shrink-0">
        <div class="w-11 h-11 rounded-lg bg-base-200 grid place-items-center overflow-hidden">
          <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" loading="lazy" />
          <Icon
            v-else
            icon="lucide:shopping-cart"
            width="20"
            height="20"
            class="text-base-content/40"
          />
        </div>
      </div>

      <!-- Name + meta -->
      <div class="flex-1 min-w-0">
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

      <!-- Price -->
      <div class="text-right shrink-0">
        <p v-if="item.retailPrice != null" class="font-semibold leading-tight">
          {{ formatPrice(item.retailPrice) }}
        </p>
        <p v-if="item.basePrice != null" class="text-xs text-base-content/60 mt-0.5">
          {{ formatBasePrice(item.basePrice, item.baseUnit) }}
        </p>
      </div>

      <!-- Delete -->
      <button
        class="btn btn-ghost btn-circle text-base-content/40 hover:text-error shrink-0"
        aria-label="Eintrag löschen"
        @click="listStore.removeItem(item.uid)"
      >
        <Icon icon="lucide:trash-2" />
      </button>
    </div>

    <!-- Optimization callout -->
    <div
      v-if="hasAlternative && alternative"
      v-auto-animate
      class="alert alert-success alert-soft mt-3 py-2 px-3"
      role="alert"
    >
      <div class="flex flex-col gap-2 w-full">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge badge-success badge-sm">
            −{{ formatPrice(alternative.savings) }}
          </span>
          <span class="text-xs font-medium">
            Günstigere Alternative gefunden
            <span v-if="alternative.matchType === 'generic'">(Eigenmarke)</span>
          </span>
        </div>

        <!-- Side-by-side comparison -->
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="rounded-lg bg-base-200/70 p-2">
            <p class="font-semibold text-base-content/60 mb-1">Aktuell</p>
            <p class="truncate">{{ item.name }}</p>
            <p class="text-base-content/70">{{ formatBasePrice(item.basePrice, item.baseUnit) }}</p>
          </div>
          <div class="rounded-lg bg-success/10 p-2">
            <p class="font-semibold text-success mb-1">Vorschlag</p>
            <p class="truncate">{{ alternative.name }}</p>
            <p class="text-base-content/70">
              {{ formatBasePrice(alternative.basePrice, alternative.baseUnit) }}
            </p>
            <p class="text-base-content/60 mt-0.5">
              {{ supermarketLabel(alternative.supermarket) }}
            </p>
          </div>
        </div>

        <button class="btn btn-success btn-sm btn-block mt-1" @click="swap">Übernehmen</button>
      </div>
    </div>
  </li>
</template>
