import { ref, computed, readonly } from 'vue'
import { useGeolocation } from '@vueuse/core'
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
 * @property {number[]} matrixIndices - Matrix indices (1-based) in visit order.
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
   * Reactive geolocation powered by VueUse's `useGeolocation`. It wraps the
   * native `navigator.geolocation.watchPosition` stream and exposes the
   * coordinates, error state and support flag as Vue refs. The watch is
   * automatically started on mount and cleared on unmount, so there is no
   * need to manage listeners manually.
   *
   * Returned refs used here:
   *  - `coords`        : { latitude, longitude, accuracy, ... } (Infinity
   *                      until the first fix arrives).
   *  - `error`         : GeolocationPositionError | null.
   *  - `isSupported`   : boolean — whether the browser supports geolocation.
   *  - `locatedAt`     : timestamp of the last successful fix.
   *  - `pause/resume`  : control the background watch (battery friendly).
   *
   * @type {ReturnType<typeof useGeolocation>}
   */
  const {
    coords: geoCoords,
    error: geoError,
    isSupported: geoSupported,
    locatedAt,
    pause,
    resume,
  } = useGeolocation({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
  })

  /**
   * Whether the browser supports the Geolocation API. When false, the user
   * can still fall back to manual selection mode.
   * @type {import('vue').ComputedRef<boolean>}
   */
  const geoSupportedRef = computed(() => geoSupported.value)

  /**
   * User location derived from the VueUse geolocation watch. `null` until
   * the first position fix arrives (coords are `Infinity` by default).
   * @type {import('vue').ComputedRef<{lat: number, lng: number}|null>}
   */
  const coords = computed(() => {
    if (
      geoCoords.value == null ||
      geoCoords.value.latitude === Infinity ||
      geoCoords.value.longitude === Infinity
    ) {
      return null
    }
    return {
      lat: geoCoords.value.latitude,
      lng: geoCoords.value.longitude,
    }
  })

  /**
   * Whether a geolocation fix is pending. VueUse does not expose an
   * explicit "loading" flag, so we derive it from the support flag and the
   * absence of both coordinates and an error.
   * @type {import('vue').ComputedRef<boolean>}
   */
  const locating = computed(() => geoSupported.value && coords.value == null && !geoError.value)

  /**
   * Origin coordinate used for routing. Mirrors `coords` but is exposed as a
   * computed so consumers can react to location changes.
   * @type {import('vue').ComputedRef<{lat: number, lng: number}|null>}
   */
  const origin = computed(() => coords.value)

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
   * Prune supermarkets that are farther from the origin than at least one
   * other store of the same chain. This keeps only the closest store(s)
   * per chain, reducing the coordinate count sent to OSRM so the request
   * stays within the demo server's limits.
   *
   * Uses Euclidean distance as a fast approximation — the actual driving
   * distance is resolved later by the OSRM Table Service.
   *
   * @param {DiscoveredSupermarket[]} stores - All discovered supermarkets.
   * @param {{lat: number, lng: number}} user - Origin coordinate.
   * @returns {DiscoveredSupermarket[]} Pruned list (closest per chain).
   */
  function pruneOuterStores(stores, user) {
    /** @type {Map<string, DiscoveredSupermarket>} */
    const bestPerChain = new Map()
    /** @type {Map<string, number>} Euclidean distance squared per chain. */
    const bestDist = new Map()
    for (const store of stores) {
      const dx = store.lon - user.lng
      const dy = store.lat - user.lat
      const dist = dx * dx + dy * dy
      const existing = bestDist.get(store.supermarketId)
      if (existing == null || dist < existing) {
        bestPerChain.set(store.supermarketId, store)
        bestDist.set(store.supermarketId, dist)
      }
    }
    return [...bestPerChain.values()]
  }

  /**
   * Query the OSRM Table Service for a driving distance matrix between the
   * origin and all supermarkets. Index 0 is always the user's location.
   *
   * When the server responds with HTTP 400 (too many coordinates or other
   * validation error), `null` is returned instead of throwing so the caller
   * can fall back to displaying the discovered supermarkets without routes.
   *
   * @param {{lat: number, lng: number}} user - Origin coordinate.
   * @param {DiscoveredSupermarket[]} stores - Supermarkets to include.
   * @returns {Promise<number[][]|null>} Distance matrix in meters, or null.
   */
  async function fetchDistanceMatrix(user, stores) {
    const coordsStr = [`${user.lng},${user.lat}`, ...stores.map((s) => `${s.lon},${s.lat}`)].join(
      ';',
    )
    const url = `${OSRM_TABLE_URL}/${coordsStr}?annotations=distance`

    const response = await fetch(url)
    if (response.status === 400) {
      // Too many coordinates or URL too long — signal the caller to fall
      // back to badge-only mode.
      return null
    }
    if (!response.ok) {
      throw new Error(`OSRM Fehler: ${response.status}`)
    }
    const json = await response.json()
    if (json.code !== 'Ok' || !Array.isArray(json.distances)) {
      return null
    }
    return json.distances
  }

  /**
   * Run an exhaustive search over the distance matrix to build candidate
   * routes. The origin (index 0) is always the start and end of every
   * route. Routes whose total driving distance exceeds `maxDistance` are
   * discarded.
   *
   * Strategy:
   *  1. Filter out stores that are unreachable (null distance from origin).
   *  2. For each supermarket chain, keep only the store closest to the
   *     origin (by driving distance) to reduce the search space.
   *  3. Enumerate all combinations of size 1, 2, 3 and 4 from the remaining
   *     representative stores.
   *  4. For each combination, try every permutation and keep the shortest
   *     round-trip (origin -> perm -> origin).
   *  5. Deduplicate by supermarket chain combination — only the shortest
   *     variant per combination id is returned.
   *
   *  No max-distance filter is applied so the user can see the total driving
   *  distance for every combination, including all 4 chains.
   *
   * @param {number[][]} matrix - Distance matrix (index 0 = origin).
   * @param {DiscoveredSupermarket[]} stores - Supermarkets (index i in matrix
   *   corresponds to stores[i-1]).
   * @param {{lat: number, lng: number}} userOrigin - Origin coordinate.
   * @returns {RouteOption[]} Valid route options sorted by total distance.
   */
  function buildRoutes(matrix, stores, userOrigin) {
    if (stores.length === 0) return []

    // 1. Filter out stores that are unreachable from the origin (OSRM
    //    returns null when no road route exists).
    /** @type {{store: DiscoveredSupermarket, index: number}[]} */
    const reachable = []
    for (let i = 0; i < stores.length; i++) {
      const matrixIdx = i + 1
      const d = matrix[0]?.[matrixIdx]
      if (d != null && d >= 0) {
        reachable.push({ store: stores[i], index: matrixIdx })
      }
    }
    if (reachable.length === 0) return []

    // 2. For each supermarket chain, keep only the store closest to the
    //    origin by driving distance.
    /** @type {Map<string, {store: DiscoveredSupermarket, index: number}>} */
    const bestPerChain = new Map()
    for (const entry of reachable) {
      const dist = matrix[0][entry.index]
      const existing = bestPerChain.get(entry.store.supermarketId)
      if (!existing || dist < matrix[0][existing.index]) {
        bestPerChain.set(entry.store.supermarketId, entry)
      }
    }
    /** @type {{store: DiscoveredSupermarket, index: number}[]} */
    const candidates = [...bestPerChain.values()]
    if (candidates.length === 0) return []

    /**
     * Generate all k-element combinations from the candidates array.
     * @param {number} k - Combination size.
     * @returns {number[][]} Arrays of indices into `candidates`.
     */
    function combinations(k) {
      const result = []
      const n = candidates.length
      if (k > n) return result
      const indices = Array.from({ length: k }, (_, i) => i)
      while (true) {
        result.push([...indices])
        let i = k - 1
        while (i >= 0 && indices[i] === n - k + i) i--
        if (i < 0) break
        indices[i]++
        for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1
      }
      return result
    }

    /**
     * Generate all permutations of an array (Heap's algorithm).
     * @param {number[]} arr - Array of indices.
     * @returns {number[][]} All permutations.
     */
    function permutations(arr) {
      const result = []
      const a = [...arr]
      const n = a.length
      const c = new Array(n).fill(0)
      result.push([...a])
      let i = 0
      while (i < n) {
        if (c[i] < i) {
          if (i % 2 === 0) {
            ;[a[0], a[i]] = [a[i], a[0]]
          } else {
            ;[a[c[i]], a[i]] = [a[i], a[c[i]]]
          }
          result.push([...a])
          c[i]++
          i = 0
        } else {
          c[i] = 0
          i++
        }
      }
      return result
    }

    /**
     * Compute the total round-trip distance for a given ordering of matrix
     * indices: origin -> stores[perm] -> origin.
     * @param {number[]} perm - Matrix indices (1-based) in visit order.
     * @returns {number|null} Total distance in meters, or null if any
     *   segment is unreachable.
     */
    function roundTripDistance(perm) {
      let total = 0
      let current = 0 // origin
      for (const idx of perm) {
        const d = matrix[current][idx]
        if (d == null) return null
        total += d
        current = idx
      }
      const back = matrix[current][0]
      if (back == null) return null
      total += back
      return total
    }

    /**
     * Build the route option object from a permutation of candidate indices.
     * @param {number[]} candidatePerm - Indices into `candidates`.
     * @param {number} total - Total driving distance in meters.
     * @returns {RouteOption}
     */
    function toRouteOption(candidatePerm, total) {
      const stops = candidatePerm.map((ci) => candidates[ci].store)
      const matrixIndices = candidatePerm.map((ci) => candidates[ci].index)
      const coords = [
        [userOrigin.lat, userOrigin.lng],
        ...stops.map((s) => [s.lat, s.lon]),
        [userOrigin.lat, userOrigin.lng],
      ]
      const supermarketIds = [...new Set(stops.map((s) => s.supermarketId))].sort()
      return {
        id: supermarketIds.join('+'),
        stops,
        totalDistance: total,
        coords,
        supermarketIds,
        matrixIndices,
      }
    }

    /** @type {Map<string, RouteOption>} Best route per supermarket combination. */
    const bestByCombination = new Map()

    // 3 & 4. Enumerate combinations of size 1-4, try all permutations per
    //    combination, keep the shortest valid round-trip.
    for (let size = 1; size <= 4; size++) {
      if (size > candidates.length) break
      for (const combo of combinations(size)) {
        let best = null
        for (const perm of permutations(combo)) {
          const matrixPerm = perm.map((ci) => candidates[ci].index)
          const dist = roundTripDistance(matrixPerm)
          if (dist == null) continue
          if (!best || dist < best.dist) {
            best = { perm, dist }
          }
        }
        if (!best) continue
        const option = toRouteOption(best.perm, best.dist)
        const existing = bestByCombination.get(option.id)
        if (!existing || option.totalDistance < existing.totalDistance) {
          bestByCombination.set(option.id, option)
        }
      }
    }

    return [...bestByCombination.values()].sort((a, b) => a.totalDistance - b.totalDistance)
  }

  /**
   * Look up the best (shortest) route for a given set of supermarket ids.
   * Returns `null` when no matching route was found (e.g. the combination
   * exceeds the maximum driving distance or a store is unreachable).
   *
   * @param {string[]} ids - Supermarket ids (order irrelevant).
   * @returns {RouteOption|null}
   */
  function getRouteForCombination(ids) {
    if (!ids || ids.length === 0) return null
    const key = [...ids].sort().join('+')
    return routes.value.find((r) => r.id === key) ?? null
  }

  /**
   * Run the full discovery pipeline: geolocation -> Overpass -> OSRM -> routes.
   * Relies on the VueUse `useGeolocation` watch for the user's position. When
   * no fix is available yet (or the user denied permission), the caller can
   * fall back to manual selection mode.
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
        // Give the VueUse geolocation watch a chance to deliver a fix. The
        // watch is started automatically on mount; if it has not produced
        // coordinates yet (or the user denied permission), we surface the
        // geolocation error and abort so the UI can offer a manual fallback.
        error.value = geoError.value?.message ?? 'Standort konnte nicht ermittelt werden'
        return
      }

      const stores = await fetchSupermarkets(userOrigin.lat, userOrigin.lng, radius.value)
      if (stores.length === 0) {
        error.value = 'Keine Supermärkte im Umkreis gefunden'
        return
      }

      // Prune outer stores: keep only the closest store per chain so the
      // OSRM request stays within the demo server's coordinate limit.
      const pruned = pruneOuterStores(stores, userOrigin)
      supermarkets.value = pruned

      const matrix = await fetchDistanceMatrix(userOrigin, pruned)

      if (matrix == null) {
        // OSRM rejected the request (e.g. too many coordinates even after
        // pruning, or a 400 error). Fall back to showing the discovered
        // supermarkets as selectable badges without route calculations.
        routes.value = []
        return
      }

      routes.value = buildRoutes(matrix, pruned, userOrigin)

      // Only keep supermarkets that are actually reachable via the road
      // network (OSRM returns null for unreachable coordinates) and that
      // appear in at least one route. This keeps the map clean.
      const reachableIds = new Set()
      for (const route of routes.value) {
        for (const stop of route.stops) {
          reachableIds.add(stop.osmId)
        }
      }
      supermarkets.value = pruned.filter((s) => reachableIds.has(s.osmId))
    } catch (err) {
      error.value = err?.message ?? 'Suche fehlgeschlagen'
    } finally {
      isLoading.value = false
    }
  }

  return {
    // Geolocation (powered by VueUse `useGeolocation`)
    coords,
    geoSupported: geoSupportedRef,
    locating,
    geoError: readonly(geoError),
    locatedAt,
    pause,
    resume,
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
    getRouteForCombination,
  }
}
