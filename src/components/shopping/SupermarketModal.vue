<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useMarketStore } from '@/stores/market'
import { useSupermarketDiscovery } from '@/composables/useSupermarketDiscovery'
import { SUPPORTED_SUPERMARKETS } from '@/utils/supermarkets'
import SupermarketMap from '@/components/shopping/SupermarketMap.vue'
import RouteOption from '@/components/shopping/RouteOption.vue'
import SupermarketBadges from '@/components/shopping/SupermarketBadges.vue'
/**
 * Supermarket pre-selection modal with location-based route discovery.
 *
 * Opens a DaisyUI dialog that lets the user input a maximum driving distance,
 * then queries Overpass + OSRM to build candidate supermarket combinations.
 * The user picks a combination either by clicking supermarket badges or by
 * selecting a route card. Selecting saves the active supermarkets to the
 * `useMarketStore` and closes the modal.
 *
 * When no geolocation is available, the badge selection becomes the primary
 * way to choose supermarkets (manual fallback).
 */
const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const marketStore = useMarketStore()
const {
  origin,
  geoSupported,
  locating,
  geoError,
  maxDistance,
  supermarkets,
  routes,
  isLoading,
  error,
  discover,
} = useSupermarketDiscovery()

/** Reference to the underlying <dialog> element. */
const dialogRef = ref(null)
/** @type {import('vue').Ref<object|null>} Currently highlighted route (map). */
const selectedRoute = ref(null)
/**
 * Working copy of the selected supermarket ids for the badge selection. This
 * is independent from the persisted store until the user applies it.
 * @type {import('vue').Ref<string[]>}
 */
const badgeSelection = ref([])

/** @type {import('vue').ComputedRef<boolean>} Whether geolocation is available. */
const geoAvailable = computed(() => geoSupported.value && !!origin.value)

/**
 * Two-way computed that exposes the maximum driving distance in kilometers
 * while the composable stores it in meters. The search radius is derived
 * from this value inside the composable.
 */
const maxDistanceKm = computed({
  get: () => maxDistance.value / 1000,
  set: (v) => {
    maxDistance.value = Math.max(1, Number(v) || 0) * 1000
  },
})

/**
 * All unique supermarket ids that appear in at least one discovered route.
 * Used to render the clickable badges.
 * @type {import('vue').ComputedRef<string[]>}
 */
const availableSupermarketIds = computed(() => {
  const set = new Set()
  for (const route of routes.value) {
    for (const id of route.supermarketIds) set.add(id)
  }
  return [...set]
})

/**
 * Route ids whose supermarket combination exactly matches the current badge
 * selection. Used to highlight matching route cards.
 * @type {import('vue').ComputedRef<string[]>}
 */
const matchedRouteIds = computed(() => {
  if (badgeSelection.value.length === 0) return []
  const key = [...badgeSelection.value].sort().join('+')
  return routes.value.filter((r) => r.id === key).map((r) => r.id)
})

/**
 * The route that matches the current badge selection (if any). Highlighted
 * on the map.
 * @type {import('vue').ComputedRef<object|null>}
 */
const matchedRoute = computed(() => {
  if (matchedRouteIds.value.length === 0) return null
  return routes.value.find((r) => r.id === matchedRouteIds.value[0]) ?? null
})

// Keep the highlighted route in sync with the badge selection so the map
// updates as the user toggles badges.
watch(matchedRoute, (r) => {
  selectedRoute.value = r
})

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
 * Trigger the discovery pipeline. Resets the current selection first.
 * @returns {Promise<void>}
 */
async function runDiscovery() {
  selectedRoute.value = null
  badgeSelection.value = []
  await discover()
}

/**
 * Toggle a supermarket id in the working badge selection.
 * @param {string} id - Supermarket id.
 */
function toggleBadge(id) {
  const idx = badgeSelection.value.indexOf(id)
  if (idx === -1) {
    badgeSelection.value = [...badgeSelection.value, id]
  } else {
    badgeSelection.value = badgeSelection.value.filter((x) => x !== id)
  }
}

/**
 * Apply the current badge selection to the market store and close the modal.
 * Falls back to the matched route's supermarket ids when available.
 */
function applyBadgeSelection() {
  if (badgeSelection.value.length === 0) return
  marketStore.setMarkets(badgeSelection.value)
  emit('close')
}

/**
 * Apply a selected route to the market store and close the modal. Also syncs
 * the badge selection so the UI stays consistent.
 * @param {object} route - The selected route option.
 */
function applyRoute(route) {
  marketStore.setMarkets(route.supermarketIds)
  badgeSelection.value = [...route.supermarketIds]
  emit('close')
}

/**
 * Toggle a supermarket in the persisted store selection (manual fallback).
 * @param {string} id - Supermarket id.
 */
function toggleMarket(id) {
  marketStore.toggleMarket(id)
}

/** Close the modal (triggered by backdrop click or close button). */
function close() {
  emit('close')
}
</script>

<template>
  <dialog ref="dialogRef" class="modal modal-middle" @close="close">
    <div class="modal-box space-y-4 max-w-lg">
      <div class="flex items-start justify-between">
        <div class="space-y-1">
          <h3 class="text-lg font-bold">Supermärkte in der Nähe</h3>
          <p class="text-sm text-base-content/70">
            Finde Supermärkte um deinen Standort und wähle eine Kombination aus.
          </p>
        </div>
        <button class="btn btn-ghost btn-sm btn-circle" aria-label="Schließen" @click="close">
          <Icon icon="lucide:x" />
        </button>
      </div>

      <!-- Geolocation status -->
      <div v-if="geoError" class="alert alert-warning text-sm py-2">
        <Icon icon="lucide:map-pin-off" width="16" />
        Standort nicht verfügbar: {{ geoError }}
      </div>
      <div v-else-if="locating" class="alert alert-info text-sm py-2">
        <Icon icon="lucide:loader-circle" width="16" class="animate-spin" />
        Standort wird ermittelt…
      </div>

      <!-- Max driving distance input (location mode only) -->
      <label v-if="geoSupported" class="form-control">
        <span class="label-text text-xs mb-1">Max. Fahrstrecke (km)</span>
        <input
          v-model.number="maxDistanceKm"
          type="number"
          min="1"
          max="100"
          step="1"
          class="input input-bordered input-sm w-full"
          :disabled="isLoading"
        />
      </label>

      <!-- Discover button (location mode only) -->
      <button
        v-if="geoSupported"
        class="btn btn-primary btn-sm w-full gap-2"
        :disabled="!geoSupported || isLoading"
        @click="runDiscovery"
      >
        <Icon icon="lucide:search" width="16" />
        Supermärkte suchen
      </button>

      <!-- Loading / error states -->
      <div v-if="isLoading" class="alert alert-info text-sm py-2">
        <Icon icon="lucide:loader-circle" width="16" class="animate-spin" />
        Suche Supermärkte und berechne Routen…
      </div>
      <div v-else-if="error" class="alert alert-error text-sm py-2">
        <Icon icon="lucide:alert-triangle" width="16" />
        {{ error }}
      </div>

      <!-- Map (location mode only) -->
      <SupermarketMap
        v-if="geoSupported"
        :origin="origin"
        :supermarkets="supermarkets"
        :selected-route="selectedRoute"
      />

      <!-- Supermarket badges (combination selection) -->
      <div v-if="availableSupermarketIds.length > 0 || !geoSupported" class="space-y-2">
        <h4 class="text-sm font-semibold">Supermarkt-Kombination wählen</h4>
        <SupermarketBadges
          :available="
            geoSupported ? availableSupermarketIds : SUPPORTED_SUPERMARKETS.map((m) => m.id)
          "
          :selected="geoSupported ? badgeSelection : marketStore.selectedMarkets"
          :matched-route-ids="matchedRouteIds"
          :active-route-id="selectedRoute?.id"
          @toggle="geoSupported ? toggleBadge($event) : toggleMarket($event)"
        />
        <button
          v-if="geoSupported"
          class="btn btn-primary btn-sm w-full"
          :disabled="badgeSelection.length === 0"
          @click="applyBadgeSelection"
        >
          Auswahl übernehmen
        </button>
      </div>

      <!-- Route options (location mode only) -->
      <div v-if="geoSupported && routes.length > 0" class="space-y-2">
        <h4 class="text-sm font-semibold">Gefundene Routen</h4>
        <div v-auto-animate class="space-y-2">
          <RouteOption
            v-for="route in routes"
            :key="route.id"
            :route="route"
            :selected="selectedRoute?.id === route.id"
            @select="applyRoute"
            @hover="selectedRoute = $event"
          />
        </div>
      </div>
      <div
        v-else-if="geoSupported && !isLoading && !error && supermarkets.length > 0"
        class="text-sm text-base-content/60"
      >
        Keine Routen innerhalb der maximalen Fahrstrecke gefunden.
      </div>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button @click="close">close</button>
    </form>
  </dialog>
</template>
