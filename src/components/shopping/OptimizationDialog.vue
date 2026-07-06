<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useShoppingListStore } from '@/stores/shoppingList'
import { formatPrice, formatBasePrice } from '@/utils/format'
import { supermarketLabel } from '@/utils/supermarkets'

/**
 * Optimization selection dialog.
 *
 * A DaisyUI modal that showcases all matching alternative products found
 * by the optimization run. Each alternative row has:
 *
 * - Product image, name, brand and supermarket.
 * - Retail + base price.
 * - A quantity selector so the user can adjust the amount before swapping
 *   (e.g. two 250 g packs instead of one 500 g pack).
 *
 * Selecting an alternative calls `listStore.replaceItem` with the chosen
 * product and quantity, then emits `replaced` so the parent can dismiss
 * the optimization result for that item.
 *
 * The dialog is designed to match the existing `SupermarketModal` styling.
 *
 * @prop {boolean} open - Whether the dialog is open.
 * @prop {object|null} result - The `OptimizationResult` to display, or null.
 * @prop {object|null} item - The shopping list item being optimized.
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  result: { type: Object, default: null },
  item: { type: Object, default: null },
})

const emit = defineEmits(['close', 'replaced', 'rejected'])

const listStore = useShoppingListStore()

/** Reference to the underlying <dialog> element. */
const dialogRef = ref(null)

/**
 * Per-alternative quantity map. Keyed by a synthetic index so each row
 * tracks its own quantity independently. Defaults to the original item's
 * quantity (carry-over) when a new result is loaded.
 * @type {import('vue').Ref<Record<number, number>>}
 */
const quantities = ref({})

/** @type {import('vue').ComputedRef<object[]>} Alternatives to display. */
const alternatives = computed(() => props.result?.alternatives ?? [])

/** @type {import('vue').ComputedRef<string>} Dialog title depending on flow. */
const title = computed(() =>
  props.result?.kind === 'price' ? 'Günstigere Alternativen' : 'Passende Produkte gefunden',
)

/**
 * Reset the per-row quantities whenever a new result is loaded. Each row
 * inherits the original item's quantity (carry-over per PRS §4.2).
 */
watch(
  alternatives,
  (list) => {
    /** @type {Record<number, number>} */
    const next = {}
    const carry = props.item?.quantity ?? 1
    list.forEach((_, i) => {
      next[i] = carry
    })
    quantities.value = next
  },
  { immediate: true },
)

// Control the native dialog element via the HTML Dialog API.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      await nextTick()
      if (dialogRef.value && !dialogRef.value.open) {
        dialogRef.value.showModal()
      }
    } else if (dialogRef.value?.open) {
      dialogRef.value.close()
    }
  },
)

/**
 * Get the quantity for a given alternative row index.
 * @param {number} index - Row index.
 * @returns {number}
 */
function getQty(index) {
  return quantities.value[index] ?? 1
}

/**
 * Set the quantity for a given alternative row index (clamped to >= 1).
 * @param {number} index - Row index.
 * @param {number} value - New quantity.
 */
function setQty(index, value) {
  quantities.value = { ...quantities.value, [index]: Math.max(1, Math.floor(Number(value) || 1)) }
}

/**
 * Confirm the selection of an alternative product. Replaces the original
 * item in the store and emits `replaced` so the parent can clear the
 * optimization result.
 * @param {object} product - The selected Typesense product document.
 * @param {number} index - Row index (for the quantity lookup).
 */
function selectAlternative(product, index) {
  if (!props.item) return
  const qty = getQty(index)
  listStore.replaceItem(props.item.uid, product, qty)
  emit('replaced', props.item.uid)
  emit('close')
}

/**
 * Reject the optimization suggestion for the current item. Emits
 * `rejected` with the item uid so the parent can dismiss the result and
 * the badge disappears from the list. Closes the dialog afterwards.
 */
function rejectSuggestion() {
  if (!props.item) return
  emit('rejected', props.item.uid)
  emit('close')
}

/** Close the dialog (backdrop click or close button). */
function close() {
  emit('close')
}
</script>

<template>
  <dialog ref="dialogRef" class="modal modal-middle" @close="close">
    <div class="modal-box space-y-4 max-w-lg flex flex-col">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <h3 class="text-lg font-bold">{{ title }}</h3>
          <p v-if="item" class="text-sm text-base-content/70 truncate">Für: {{ item.name }}</p>
        </div>
        <button class="btn btn-ghost btn-sm btn-circle" aria-label="Schließen" @click="close">
          <Icon icon="lucide:x" />
        </button>
      </div>

      <!-- Alternatives list -->
      <div v-if="alternatives.length > 0" class="space-y-2 max-h-[60vh] overflow-y-auto">
        <div
          v-for="(product, index) in alternatives"
          :key="product.id ?? index"
          class="flex items-center gap-3 p-2 rounded-box hover:bg-base-200/50 transition-colors"
        >
          <!-- Product image -->
          <div class="avatar avatar-placeholder shrink-0">
            <div class="w-12 h-12 rounded-lg bg-base-200 grid place-items-center overflow-hidden">
              <img
                v-if="product.imageUrl"
                :src="product.imageUrl"
                :alt="product.name"
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

          <!-- Name + meta -->
          <div class="flex-1 min-w-0">
            <p class="font-medium leading-tight truncate">{{ product.name }}</p>
            <p class="text-xs text-base-content/60 truncate mt-0.5">
              {{ product.brand || '—' }} · {{ supermarketLabel(product.supermarket) }}
            </p>
            <p class="text-xs text-base-content/60 mt-0.5">
              {{ formatBasePrice(product.basePrice, product.baseUnit) }}
            </p>
          </div>

          <!-- Quantity selector (plain input, no +/- buttons) -->
          <input
            type="number"
            min="1"
            class="input input-bordered input-xs w-14 text-center shrink-0 px-1"
            :value="getQty(index)"
            aria-label="Menge"
            @change="setQty(index, Number($event.target.value))"
          />

          <!-- Total price + select -->
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span class="font-semibold text-sm whitespace-nowrap">
              {{ formatPrice((product.retailPrice ?? 0) * getQty(index)) }}
            </span>
            <button
              type="button"
              class="btn btn-primary btn-xs gap-1"
              @click="selectAlternative(product, index)"
            >
              <Icon icon="lucide:check" width="12" height="12" />
              Wählen
            </button>
          </div>
        </div>
      </div>

      <p v-else class="text-center text-base-content/60 py-8">Keine Alternativen gefunden.</p>

      <!-- Footer -->
      <div class="modal-action gap-2">
        <button class="btn btn-ghost btn-error gap-1" @click="rejectSuggestion">
          <Icon icon="lucide:x" width="16" height="16" />
          Ablehnen
        </button>
        <button class="btn btn-ghost" @click="close">Schließen</button>
      </div>
    </div>

    <!-- Backdrop click closes the dialog -->
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
