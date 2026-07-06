import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { SUPPORTED_SUPERMARKETS } from '@/utils/supermarkets'

/**
 * Pinia store that tracks the currently selected supermarkets and the
 * persisted location-based discovery state.
 *
 * The selection and the discovery results (origin, supermarkets, routes,
 * route metrics) are persisted to localStorage via VueUse's `useLocalStorage`
 * so that the user's preferred supermarkets and the last computed map view
 * survive page reloads without re-running the Overpass/OSRM pipeline.
 *
 * @returns {object} Store state and actions.
 */
export const useMarketStore = defineStore('market', () => {
  /**
   * Selected supermarket ids, persisted in localStorage under the key
   * `korbkumpel.selectedMarkets`.
   * @type {import('vue').Ref<string[]>}
   */
  const selectedMarkets = useLocalStorage('korbkumpel.selectedMarkets', [])

  /**
   * Total driving distance (meters) for the currently selected supermarket
   * combination, as computed by the OSRM Table Service. Persisted so the
   * rest of the app can display it without re-running the discovery.
   * @type {import('vue').Ref<number>}
   */
  const routeDistance = useLocalStorage('korbkumpel.routeDistance', 0)

  /**
   * Total driving duration (seconds) for the currently selected supermarket
   * combination, as computed by the OSRM Table Service. Persisted so the
   * rest of the app can display it without re-running the discovery.
   * @type {import('vue').Ref<number>}
   */
  const routeDuration = useLocalStorage('korbkumpel.routeDuration', 0)

  /**
   * Last known user origin coordinate `{ lat, lng }` from a successful
   * geolocation fix. Persisted so the map can be restored on reload
   * without re-requesting the geolocation permission.
   * @type {import('vue').Ref<{lat: number, lng: number}|null>}
   */
  const lastOrigin = useLocalStorage('korbkumpel.lastOrigin', null)

  /**
   * Last discovered supermarkets (pruned, reachable set) from a successful
   * discovery run. Persisted so the map markers can be restored on reload
   * without re-querying Overpass/OSRM.
   * @type {import('vue').Ref<object[]>}
   */
  const lastSupermarkets = useLocalStorage('korbkumpel.lastSupermarkets', [])

  /**
   * Last computed route options from a successful discovery run. Persisted
   * so the route cards / badge marginal costs can be restored on reload.
   * @type {import('vue').Ref<object[]>}
   */
  const lastRoutes = useLocalStorage('korbkumpel.lastRoutes', [])

  /**
   * Whether the user denied or failed geolocation on the last session.
   * When true, the app falls back to manual badge selection and the
   * driving time is excluded from the total shopping time estimate.
   * @type {import('vue').Ref<boolean>}
   */
  const locationDenied = useLocalStorage('korbkumpel.locationDenied', false)

  /**
   * Whether a valid location-based discovery result is available from the
   * persisted state (origin + at least one supermarket). Used to decide
   * whether the map can be shown immediately on reload.
   * @type {import('vue').ComputedRef<boolean>}
   */
  const hasDiscovery = computed(() => !!lastOrigin.value && lastSupermarkets.value.length > 0)

  /**
   * Whether driving time should be included in the total shopping time
   * estimate. Driving time is only relevant when a location-based
   * discovery was performed and not denied.
   * @type {import('vue').ComputedRef<boolean>}
   */
  const includeDrivingTime = computed(() => !locationDenied.value && hasDiscovery.value)

  /**
   * Comma separated list of selected supermarket ids, ready to be injected
   * into a Typesense `filter_by` expression.
   * @type {import('vue').ComputedRef<string>}
   */
  const filterExpression = computed(() => {
    if (selectedMarkets.value.length === 0) return ''
    const list = selectedMarkets.value.map((id) => `\`${id}\``).join(',')
    return `supermarket: [${list}]`
  })

  /** @type {import('vue').ComputedRef<boolean>} Whether any market is selected. */
  const hasSelection = computed(() => selectedMarkets.value.length > 0)

  /**
   * Replace the current selection with a new array of supermarket ids.
   * @param {string[]} ids - Array of supermarket ids.
   */
  function setMarkets(ids) {
    selectedMarkets.value = [...new Set(ids)]
  }

  /**
   * Persist the driving route metrics (distance + duration) for the current
   * selection. Called by the supermarket modal whenever the user picks a
   * combination.
   * @param {number} distance - Total driving distance in meters.
   * @param {number} duration - Total driving duration in seconds.
   */
  function setRouteMetrics(distance, duration) {
    routeDistance.value = Math.max(0, Number(distance) || 0)
    routeDuration.value = Math.max(0, Number(duration) || 0)
  }

  /**
   * Persist the full discovery result so it can be restored on reload
   * without re-running the Overpass/OSRM pipeline.
   * @param {{lat: number, lng: number}} origin - User origin coordinate.
   * @param {object[]} supermarkets - Discovered supermarkets.
   * @param {object[]} routes - Computed route options.
   */
  function setDiscoveryResult(origin, supermarkets, routes) {
    lastOrigin.value = origin ? { lat: origin.lat, lng: origin.lng } : null
    lastSupermarkets.value = supermarkets ?? []
    lastRoutes.value = routes ?? []
    locationDenied.value = false
  }

  /**
   * Mark the location as denied/failed so the app falls back to manual
   * badge selection and excludes driving time from the total estimate.
   */
  function markLocationDenied() {
    locationDenied.value = true
    routeDistance.value = 0
    routeDuration.value = 0
  }

  /**
   * Clear the persisted discovery state (e.g. when the user starts a new
   * discovery run). Keeps the selected markets intact.
   */
  function clearDiscovery() {
    lastOrigin.value = null
    lastSupermarkets.value = []
    lastRoutes.value = []
    routeDistance.value = 0
    routeDuration.value = 0
  }

  /**
   * Toggle a single supermarket id in the selection.
   * @param {string} id - Supermarket id to toggle.
   */
  function toggleMarket(id) {
    const idx = selectedMarkets.value.indexOf(id)
    if (idx === -1) {
      selectedMarkets.value.push(id)
    } else {
      selectedMarkets.value.splice(idx, 1)
    }
  }

  /** Reset the selection back to empty. */
  function clearMarkets() {
    selectedMarkets.value = []
    routeDistance.value = 0
    routeDuration.value = 0
    lastOrigin.value = null
    lastSupermarkets.value = []
    lastRoutes.value = []
    locationDenied.value = false
  }

  return {
    selectedMarkets,
    routeDistance,
    routeDuration,
    lastOrigin,
    lastSupermarkets,
    lastRoutes,
    locationDenied,
    hasDiscovery,
    includeDrivingTime,
    filterExpression,
    hasSelection,
    setMarkets,
    setRouteMetrics,
    setDiscoveryResult,
    markLocationDenied,
    clearDiscovery,
    toggleMarket,
    clearMarkets,
  }
})

export { SUPPORTED_SUPERMARKETS }
