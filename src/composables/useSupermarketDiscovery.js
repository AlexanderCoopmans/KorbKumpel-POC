import { ref, computed, readonly } from 'vue'
import { brandRegex, brandToSupermarketId } from '@/utils/brandMapping'
import { supermarketLabel } from '@/utils/supermarkets'

/**
 * @typedef {Object} DiscoveredSupermarket
 * @property {number} osmId - OpenStreetMap node id.
 * @property {number} lat - Latitude.
 * @property {number} lon - Longitude.
 * @property {string} brand - Raw brand tag from OSM.
 * @property {string} supermarketId - Internal supermarket id (e.g. `aldi-sued`).
 * @property {string} label - Human friendly label.
 * @property {string} name - Optional store name from OSM.
 */

/**
 * @typedef {Object} RouteOption
 * @property {string} id - Stable id (joined supermarket ids).
 * @property {DiscoveredSupermarket[]} stops - Ordered supermarkets visited.
 * @property {number} totalDistance - Total driving distance in meters.
 * @property {number[][]} coords - Ordered [lat, lon] pairs for polyline drawing.
 * @property {string[]} supermarketIds - Unique supermarket ids on this route.
 */

/** Overpass API endpoint used to fetch supermarket nodes. */
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

/** OSRM Table Service endpoint (driving profile). */
const OSRM_TABLE_URL = 'https://router.project-osrm.org/table/v1/driving'

/**
 * Composable that powers the location-based supermarket pre-selection.
 *
 * It performs four steps:
 *  1. Reads the user's geolocation via `useGeolocation`.
 *  2. Queries the Overpass API for supermarket nodes within a radius.
 *  3. Calls the OSRM Table Service to build a driving distance matrix.
 *  4. Runs a Nearest-Neighbor heuristic to build candidate routes that do
 *     not exceed the maximum driving distance.
 *
 * The composable exposes reactive state that the `SupermarketModal` renders.
 *
 * @returns {object} Reactive state and the `discover` action.
 */
export function useSupermarketDiscovery() {
  /**
   * Whether the browser supports the Geolocation API. When false, the user
   * can still fall back to manual selection mode.
   * @type {import('vue').ComputedRef<boolean>}
   */
  const geoSupported = computed(
    () => typeof navigator !== 'undefined' && 'geolocation' in navigator,
  )

  /** @type {import('vue').Ref<{lat: number, lng: number}|null>} User location. */
  const coords = ref(null)
  /** @type {import('vue').Ref<boolean>} Whether a geolocation request is pending. */
  const locating = ref(false)
  /** @type {import('vue').Ref<string|null>} Geolocation error message, if any. */
  const geoError = ref(null)

  /**
   * Request the user's current position via the Geolocation API. Resolves
   * with the coordinates and stores them in `coords`. When the browser does
   * not support geolocation or the user denies permission, `geoError` is set
   * and the caller can fall back to manual selection.
   *
   * @returns {Promise<{lat: number, lng: number}|null>}
   */
  function requestLocation() {
    return new Promise((resolve) => {
      if (!geoSupported.value) {
        geoError.value = 'Geolocation wird nicht unterstützt'
        resolve(null)
        return
      }
      locating.value = true
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          coords.value = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }
          locating.value = false
          geoError.value = null
          resolve(coords.value)
        },
        (err) => {
          geoError.value = err?.message ?? 'Standort nicht verfügbar'
          locating.value = false
          resolve(null)
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
      )
    })
  }

  /** @type {import('vue').Ref<number>} Maximum acceptable total driving distance in meters. The search radius is derived from this value. */
  const maxDistance = ref(20000)

  /**
   * Search radius in meters, derived from `maxDistance` so the Overpass
   * query covers at least the area the user is willing to drive.
   * @type {import('vue').ComputedRef<number>}
   */
  const radius = computed(() => maxDistance.value)

  /** @type {import('vue').Ref<DiscoveredSupermarket[]>} Raw Overpass results. */
  const supermarkets = ref([])
  /** @type {import('vue').Ref<RouteOption[]>} Calculated route options. */
  const routes = ref([])

  /** @type {import('vue').Ref<boolean>} Whether a discovery run is in progress. */
  const isLoading = ref(false)
  /** @type {import('vue').Ref<string|null>} Error message, if any. */
  const error = ref(null)

  /**
   * Origin coordinate used for routing. Mirrors `coords` but is exposed as a
   * computed so consumers can react to location changes.
   * @type {import('vue').ComputedRef<{lat: number, lng: number}|null>}
   */
  const origin = computed(() => coords.value)

  /**
   * Fetch supermarket nodes from the Overpass API around the user's location.
   * @param {number} lat - Origin latitude.
   * @param {number} lng - Origin longitude.
   * @param {number} searchRadius - Search radius in meters.
   * @returns {Promise<DiscoveredSupermarket[]>} Mapped supermarkets.
   */
  async function fetchSupermarkets(lat, lng, searchRadius) {
    const query = `[out:json][timeout:25];node["shop"="supermarket"]["brand"~"${brandRegex()}",i](around:${searchRadius},${lat},${lng});out body;`
    const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Overpass Fehler: ${response.status}`)
    }
    const json = await response.json()

    /** @type {DiscoveredSupermarket[]} */
    const mapped = []
    for (const el of json.elements ?? []) {
      const supermarketId = brandToSupermarketId(el.tags?.brand)
      if (!supermarketId) continue
      mapped.push({
        osmId: el.id,
        lat: el.lat,
        lon: el.lon,
        brand: el.tags?.brand ?? '',
        supermarketId,
        label: supermarketLabel(supermarketId),
        name: el.tags?.name ?? el.tags?.brand ?? '',
      })
    }
    return mapped
  }

  /**
   * Query the OSRM Table Service for a driving distance matrix between the
   * origin and all supermarkets. Index 0 is always the user's location.
   *
   * @param {{lat: number, lng: number}} user - Origin coordinate.
   * @param {DiscoveredSupermarket[]} stores - Supermarkets to include.
   * @returns {Promise<number[][]>} Distance matrix in meters.
   */
  async function fetchDistanceMatrix(user, stores) {
    const coordsStr = [`${user.lng},${user.lat}`, ...stores.map((s) => `${s.lon},${s.lat}`)].join(
      ';',
    )
    const url = `${OSRM_TABLE_URL}/${coordsStr}?annotations=distance`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`OSRM Fehler: ${response.status}`)
    }
    const json = await response.json()
    if (json.code !== 'Ok' || !Array.isArray(json.distances)) {
      throw new Error('OSRM konnte keine Routen berechnen')
    }
    return json.distances
  }

  /**
   * Run a Nearest-Neighbor heuristic over the distance matrix to build
   * candidate routes. The origin (index 0) is always the start and end of
   * every route. Routes whose total driving distance exceeds `maxDistance`
   * are discarded.
   *
   * Each route is deduplicated by its set of supermarket ids (regardless of
   * which physical store was visited) so the user is offered every unique
   * combination of 1, 2 or 3 supermarkets exactly once — the shortest
   * variant of each combination wins.
   *
   * @param {number[][]} matrix - Distance matrix (index 0 = origin).
   * @param {DiscoveredSupermarket[]} stores - Supermarkets (index i in matrix
   *   corresponds to stores[i-1]).
   * @param {{lat: number, lng: number}} userOrigin - Origin coordinate.
   * @returns {RouteOption[]} Valid route options sorted by total distance.
   */
  function buildRoutes(matrix, stores, userOrigin) {
    const n = stores.length
    if (n === 0) return []

    /**
     * Build a Nearest-Neighbor route that visits exactly `targetLen`
     * supermarkets, starting from the given seed index. Returns the ordered
     * store indices (1-based) and the total driving distance including the
     * return trip.
     *
     * @param {number} seedIndex - 1-based index into the matrix.
     * @param {number} targetLen - Number of supermarkets to visit.
     * @returns {{order: number[], total: number}|null}
     */
    function nearestNeighborFrom(seedIndex, targetLen) {
      const visited = new Set([0, seedIndex])
      const order = [seedIndex]
      let total = matrix[0][seedIndex]
      let current = seedIndex

      while (order.length < targetLen) {
        let next = -1
        let best = Infinity
        for (let i = 1; i <= n; i++) {
          if (visited.has(i)) continue
          const d = matrix[current][i]
          if (d != null && d < best) {
            best = d
            next = i
          }
        }
        if (next === -1) break
        order.push(next)
        visited.add(next)
        total += best
        current = next
      }
      // Return trip back to origin.
      total += matrix[current][0]
      return { order, total }
    }

    /**
     * Build the route option object from an ordered list of store indices.
     * @param {number[]} order - 1-based store indices.
     * @param {number} total - Total driving distance in meters.
     * @returns {RouteOption}
     */
    function toRouteOption(order, total) {
      const stops = order.map((i) => stores[i - 1])
      const coords = [
        [userOrigin.lat, userOrigin.lng],
        ...order.map((i) => [stores[i - 1].lat, stores[i - 1].lon]),
        [userOrigin.lat, userOrigin.lng],
      ]
      // Deduplicate supermarket ids so the same chain visited twice still
      // produces a stable combination key.
      const supermarketIds = [...new Set(stops.map((s) => s.supermarketId))]
      return {
        id: supermarketIds.join('+'),
        stops,
        totalDistance: total,
        coords,
        supermarketIds,
      }
    }

    /** @type {Map<string, RouteOption>} Best route per supermarket combination. */
    const bestByCombination = new Map()

    // Explore combinations of size 1, 2 and 3. For each size we seed a
    // Nearest-Neighbor run from every supermarket so we cover all unique
    // combinations. The shortest variant per combination id wins.
    for (let targetLen = 1; targetLen <= 3; targetLen++) {
      if (targetLen > n) break
      for (let seed = 1; seed <= n; seed++) {
        const result = nearestNeighborFrom(seed, targetLen)
        if (!result || result.total > maxDistance.value) continue
        const option = toRouteOption(result.order, result.total)
        const existing = bestByCombination.get(option.id)
        if (!existing || option.totalDistance < existing.totalDistance) {
          bestByCombination.set(option.id, option)
        }
      }
    }

    return [...bestByCombination.values()].sort((a, b) => a.totalDistance - b.totalDistance)
  }

  /**
   * Run the full discovery pipeline: geolocation -> Overpass -> OSRM -> routes.
   * Requests the user's location first; when it is unavailable the caller
   * can fall back to manual selection mode.
   * @returns {Promise<void>}
   */
  async function discover() {
    isLoading.value = true
    error.value = null
    routes.value = []
    supermarkets.value = []

    try {
      let userOrigin = origin.value
      if (!userOrigin) {
        userOrigin = await requestLocation()
      }
      if (!userOrigin) {
        // Geolocation unavailable — surface the geo error and abort. The UI
        // offers a manual fallback selection in this case.
        error.value = geoError.value ?? 'Standort konnte nicht ermittelt werden'
        return
      }

      const stores = await fetchSupermarkets(userOrigin.lat, userOrigin.lng, radius.value)
      if (stores.length === 0) {
        error.value = 'Keine Supermärkte im Umkreis gefunden'
        return
      }
      supermarkets.value = stores

      const matrix = await fetchDistanceMatrix(userOrigin, stores)
      routes.value = buildRoutes(matrix, stores, userOrigin)
    } catch (err) {
      error.value = err?.message ?? 'Suche fehlgeschlagen'
    } finally {
      isLoading.value = false
    }
  }

  return {
    // Geolocation
    coords,
    geoSupported,
    locating,
    geoError: readonly(geoError),
    requestLocation,
    origin,
    // Inputs
    radius,
    maxDistance,
    // Results
    supermarkets,
    routes,
    isLoading,
    error,
    // Action
    discover,
  }
}
