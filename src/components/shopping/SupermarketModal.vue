<script setup>
import { ref, watch, nextTick, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useMarketStore } from '@/stores/market'
import { useSupermarketDiscovery } from '@/composables/useSupermarketDiscovery'
import { SUPPORTED_SUPERMARKETS } from '@/utils/supermarkets'
import { formatDuration, formatDistance } from '@/utils/format'
import SupermarketMap from '@/components/shopping/SupermarketMap.vue'
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
  getRouteForCombination,
} = useSupermarketDiscovery()

/** Reference to the underlying <dialog> element. */
const dialogRef = ref(null)
/** @type {import('vue').Ref<object|null>} Currently highlighted route (map). */
const selectedRoute = ref(null)
/**
 * Working copy of the selected supermarket ids for the badge selection. This
 * is independent from the persisted store until the user applies it.
 * Seeded from the persisted store selection so previously chosen
 * supermarkets are preselected when the modal is opened after a reload.
 * @type {import('vue').Ref<string[]>}
 */
const badgeSelection = ref([...marketStore.selectedMarkets])

/** @type {import('vue').ComputedRef<boolean>} Whether geolocation is available. */
const geoAvailable = computed(() => geoSupported.value && !!origin.value)

/**
 * Whether the user denied or failed geolocation. In this case the modal
 * falls back to a badge-only selection with all supported supermarkets.
 * Mirrors the persisted store flag so the fallback survives reloads.
 * @type {import('vue').ComputedRef<boolean>}
 */
const locationDenied = computed(
  () => (!!geoError.value && !origin.value) || marketStore.locationDenied,
)

/**
 * Whether the location-based discovery UI (map, routes, distance input)
 * should be shown. Only when geolocation is available and not denied.
 * @type {import('vue').ComputedRef<boolean>}
 */
const showLocationUi = computed(() => geoSupported.value && !locationDenied.value)

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
 * Total distance of the currently selected badge combination, or 0 when no
 * badges are selected. Used as the baseline for computing marginal costs.
 * @type {import('vue').ComputedRef<number>}
 */
const currentSelectionDistance = computed(() => {
  if (badgeSelection.value.length === 0) return 0
  return getRouteForCombination(badgeSelection.value)?.totalDistance ?? 0
})

/**
 * Total duration of the currently selected badge combination, or 0 when no
 * badges are selected. Used as the baseline for computing marginal durations.
 * @type {import('vue').ComputedRef<number>}
 */
const currentSelectionDuration = computed(() => {
  if (badgeSelection.value.length === 0) return 0
  return getRouteForCombination(badgeSelection.value)?.totalDuration ?? 0
})

/**
 * Map of supermarket id -> additional distance (in meters) incurred by
 * adding that supermarket to the current badge selection. When the
 * supermarket is already selected, the value is 0. When no valid route
 * exists for the resulting combination, the value is `null`.
 * @type {import('vue').ComputedRef<Record<string, number|null>>}
 */
const marginalCosts = computed(() => {
  /** @type {Record<string, number|null>} */
  const costs = {}
  for (const id of availableSupermarketIds.value) {
    if (badgeSelection.value.includes(id)) {
      costs[id] = 0
      continue
    }
    const extended = [...badgeSelection.value, id]
    const route = getRouteForCombination(extended)
    if (!route) {
      costs[id] = null
    } else {
      costs[id] = Math.max(0, route.totalDistance - currentSelectionDistance.value)
    }
  }
  return costs
})

/**
 * Map of supermarket id -> additional duration (in seconds) incurred by
 * adding that supermarket to the current badge selection. When the
 * supermarket is already selected, the value is 0. When no valid route
 * exists for the resulting combination, the value is `null`.
 * @type {import('vue').ComputedRef<Record<string, number|null>>}
 */
const marginalDurations = computed(() => {
  /** @type {Record<string, number|null>} */
  const durations = {}
  for (const id of availableSupermarketIds.value) {
    if (badgeSelection.value.includes(id)) {
      durations[id] = 0
      continue
    }
    const extended = [...badgeSelection.value, id]
    const route = getRouteForCombination(extended)
    if (!route) {
      durations[id] = null
    } else {
      durations[id] = Math.max(0, route.totalDuration - currentSelectionDuration.value)
    }
  }
  return durations
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

/**
 * Human readable label for the total driving duration of the current badge
 * selection, followed by the total distance in parentheses. Empty when no
 * badges are selected.
 * @type {import('vue').ComputedRef<string>}
 */
const totalDurationLabel = computed(() => {
  const d = currentSelectionDuration.value
  const m = currentSelectionDistance.value
  if (d === 0 && m === 0) return ''
  return `${formatDuration(d)} (${formatDistance(m)})`
})

// Keep the highlighted route in sync with the badge selection so the map
// updates as the user toggles badges.
watch(matchedRoute, (r) => {
  selectedRoute.value = r
})

// When the modal is opened, seed the badge selection from the persisted
// store selection so previously chosen supermarkets are preselected after
// a page reload. Also restore the matching route highlight when routes
// are already available from the persisted discovery state.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      badgeSelection.value = [...marketStore.selectedMarkets]
      if (matchedRoute.value) {
        selectedRoute.value = matchedRoute.value
      }
    }
  },
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
 * Trigger the discovery pipeline. Resets the current selection first and
 * clears the persisted discovery state so a fresh run starts clean.
 * @returns {Promise<void>}
 */
async function runDiscovery() {
  selectedRoute.value = null
  badgeSelection.value = []
  marketStore.clearDiscovery()
  await discover()
}

/**
 * Toggle a supermarket id in the working badge selection and immediately
 * persist the new selection together with the route metrics to the market
 * store.
 * @param {string} id - Supermarket id.
 */
function toggleBadge(id) {
  const idx = badgeSelection.value.indexOf(id)
  if (idx === -1) {
    badgeSelection.value = [...badgeSelection.value, id]
  } else {
    badgeSelection.value = badgeSelection.value.filter((x) => x !== id)
  }
  marketStore.setMarkets(badgeSelection.value)
  const route = getRouteForCombination(badgeSelection.value)
  marketStore.setRouteMetrics(route?.totalDistance ?? 0, route?.totalDuration ?? 0)
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
    <div class="modal-box space-y-4 max-w-lg flex flex-col items-end">
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

      <!-- Supermarket badges (combination selection) -->
      <div v-if="locationDenied || availableSupermarketIds.length > 0" class="space-y-2 w-full">
        <h4 class="text-sm font-semibold">Supermarkt-Kombination wählen</h4>
        <SupermarketBadges
          :available="
            locationDenied ? SUPPORTED_SUPERMARKETS.map((m) => m.id) : availableSupermarketIds
          "
          :selected="locationDenied ? marketStore.selectedMarkets : badgeSelection"
          :marginal-costs="marginalCosts"
          :marginal-durations="marginalDurations"
          :show-costs="!locationDenied"
          @toggle="locationDenied ? toggleMarket($event) : toggleBadge($event)"
        />
        <!-- Total driving duration for the current selection -->
        <div
          v-if="!locationDenied && badgeSelection.length > 0"
          class="flex items-center gap-2 text-sm text-base-content/70"
        >
          <Icon icon="lucide:clock" width="16" />
          <span
            >Gesamtfahrzeit: <strong>{{ totalDurationLabel }}</strong></span
          >
        </div>
      </div>

      <!-- Geolocation status -->
      <div v-if="locationDenied" class="alert alert-warning text-sm py-2">
        <Icon icon="lucide:map-pin-off" width="16" />
        Standort nicht verfügbar – wähle Supermärkte manuell.
      </div>
      <div v-else-if="locating" class="alert alert-info text-sm py-2">
        <Icon icon="lucide:loader-circle" width="16" class="animate-spin" />
        Standort wird ermittelt…
      </div>

      <!-- Map (location mode only) -->
      <SupermarketMap
        v-if="showLocationUi && origin && supermarkets?.length > 0"
        :origin="origin"
        :supermarkets="supermarkets"
        :selected-route="selectedRoute"
      />

      <!-- Max driving distance input (location mode only) -->
      <label v-if="showLocationUi && !locationDenied" class="form-control w-full">
        <span class="label-text text-xs mb-1">Max. Fahrstrecke (km)</span>
        <div class="join">
          <input
            v-model.number="maxDistanceKm"
            type="number"
            min="1"
            max="100"
            step="1"
            class="input input-bordered input-sm w-full join-item"
            :disabled="isLoading"
          />
          <button
            v-if="showLocationUi"
            class="btn btn-secondary btn-sm gap-2 join-item"
            :disabled="isLoading"
            @click="runDiscovery"
          >
            <Icon icon="lucide:search" width="16" />
            Supermärkte suchen
          </button>
        </div>
      </label>

      <!-- Discover button (location mode only) -->

      <!-- Loading / error states -->
      <div v-if="isLoading" class="alert alert-info text-sm py-2">
        <Icon icon="lucide:loader-circle" width="16" class="animate-spin" />
        Suche Supermärkte und berechne Routen…
      </div>
      <div v-else-if="error" class="alert alert-error text-sm py-2">
        <Icon icon="lucide:alert-triangle" width="16" />
        {{ error }}
      </div>

      <button class="btn btn-primary" @click="close">Schließen</button>
    </div>

    <form method="dialog" class="modal-backdrop">
      <button @click="close">close</button>
    </form>
  </dialog>
</template>
