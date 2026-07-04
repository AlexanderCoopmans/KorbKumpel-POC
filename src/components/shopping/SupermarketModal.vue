<script setup>
import { ref, watch, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useMarketStore } from '@/stores/market'
import { SUPPORTED_SUPERMARKETS } from '@/utils/supermarkets'

/**
 * Supermarket pre-selection modal.
 *
 * Opens a DaisyUI dialog that lets the user multi-select which supermarkets
 * to include in the current session. The selection is stored in the
 * `useMarketStore` Pinia store and injected into all subsequent Typesense
 * search queries.
 */

/** Whether the modal is currently open. */
const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const marketStore = useMarketStore()

/** Reference to the underlying <dialog> element. */
const dialogRef = ref(null)

/** Local working copy so the user can cancel without applying changes. */
const localSelection = ref([])

// Sync the local copy whenever the modal is opened and control the native
// dialog element via the HTML Dialog API.
watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      localSelection.value = [...marketStore.selectedMarkets]
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
 * Toggle a supermarket in the local selection.
 * @param {string} id - Supermarket id.
 */
function toggle(id) {
  const idx = localSelection.value.indexOf(id)
  if (idx === -1) localSelection.value.push(id)
  else localSelection.value.splice(idx, 1)
}

/** Apply the local selection to the store and close the modal. */
function apply() {
  marketStore.setMarkets(localSelection.value)
  emit('close')
}

/** Discard the local selection and close the modal. */
function cancel() {
  emit('close')
}
</script>

<template>
  <dialog ref="dialogRef" class="modal modal-middle" @close="cancel">
    <div class="modal-box space-y-4">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <h3 class="text-lg font-bold">Supermärkte auswählen</h3>
          <p class="text-sm text-base-content/70">
            Wähle die Supermärkte, die du für deine Einkaufsliste berücksichtigen möchtest.
          </p>
        </div>
        <button class="btn btn-ghost btn-sm btn-circle" aria-label="Schließen" @click="cancel">
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
            :checked="localSelection.includes(market.id)"
            @change="toggle(market.id)"
          />
          <span class="font-medium">{{ market.label }}</span>
        </label>
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" @click="cancel">Abbrechen</button>
        <button class="btn btn-primary" @click="apply">Übernehmen</button>
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button @click="cancel">close</button>
    </form>
  </dialog>
</template>
