<script setup>
import { ref, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useMarketStore } from '@/stores/market'
import { SUPPORTED_SUPERMARKETS } from '@/utils/supermarkets'

/**
 * Supermarket pre-selection modal.
 *
 * Opens a DaisyUI dialog that lets the user multi-select which supermarkets
 * to include in the current session. Changes are applied to the
 * `useMarketStore` Pinia store immediately (no apply/cancel buttons) and the
 * selection is persisted to localStorage via `useLocalStorage`.
 */
const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const marketStore = useMarketStore()

/** Reference to the underlying <dialog> element. */
const dialogRef = ref(null)

// Control the native dialog element via the HTML Dialog API. The selection
// is read directly from the persisted store, so there is no local working
// copy — every toggle is applied immediately.
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
 * Toggle a supermarket in the persisted store selection immediately.
 * @param {string} id - Supermarket id.
 */
function toggle(id) {
  marketStore.toggleMarket(id)
}

/** Close the modal (triggered by backdrop click or close button). */
function close() {
  emit('close')
}
</script>

<template>
  <dialog ref="dialogRef" class="modal modal-middle" @close="close">
    <div class="modal-box space-y-4">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <h3 class="text-lg font-bold">Supermärkte auswählen</h3>
          <p class="text-sm text-base-content/70">
            Wähle die Supermärkte, die du für deine Einkaufsliste berücksichtigen möchtest.
          </p>
        </div>
        <button class="btn btn-ghost btn-sm btn-circle" aria-label="Schließen" @click="close">
          <Icon icon="lucide:x" width="18" height="18" />
        </button>
      </div>

      <div class="grid grid-cols-1 gap-2">
        <label
          v-for="market in SUPPORTED_SUPERMARKETS"
          :key="market.id"
          class="flex items-center gap-3 rounded-box border border-base-300 p-3 cursor-pointer hover:bg-base-200 transition-colors"
        >
          <input
            type="checkbox"
            class="checkbox checkbox-primary"
            :checked="marketStore.selectedMarkets.includes(market.id)"
            @change="toggle(market.id)"
          />
          <span class="font-medium">{{ market.label }}</span>
        </label>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button @click="close">close</button>
    </form>
  </dialog>
</template>
