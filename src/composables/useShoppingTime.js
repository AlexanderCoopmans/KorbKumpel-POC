import { computed } from 'vue'
import { useShoppingListStore } from '@/stores/shoppingList'
import { useMarketStore } from '@/stores/market'

/**
 * @typedef {Object} GroupTime
 * @property {string} key - Supermarket id or `__raw__`.
 * @property {number} itemCount - Number of items (with quantity) in this group.
 * @property {number} duration - Estimated stay duration in seconds.
 */

/** Base stay duration per visited supermarket, in seconds. */
const BASE_STAY_SECONDS = 480
/** Additional seconds per item in a supermarket group. */
const PER_ITEM_SECONDS = 30

/**
 * Shared composable that computes estimated shopping times from the current
 * shopping list and the persisted OSRM route metrics.
 *
 * The time model is:
 *  - Driving duration from `marketStore.routeDuration` (OSRM Table Service).
 *  - For every supermarket group with at least one specific item:
 *    `BASE_STAY_SECONDS + itemCount * PER_ITEM_SECONDS`.
 *  - The "Sonstiges" (`__raw__`) group has no base stay; each raw item adds
 *    `PER_ITEM_SECONDS` seconds (representing extra time spread across stores).
 *
 * Centralized here so both `ListSummary` (total) and `GroupedList` (per-group)
 * render consistent values without duplicating the formula.
 *
 * @returns {{ totalTime: import('vue').ComputedRef<number>, groupTimes: import('vue').ComputedRef<Record<string, number>>, rawItemCount: import('vue').ComputedRef<number>, includesDriving: import('vue').ComputedRef<boolean> }}
 */
export function useShoppingTime() {
  const listStore = useShoppingListStore()
  const marketStore = useMarketStore()

  /**
   * Number of unspecific (raw) items on the list. These are items without a
   * dedicated supermarket and add `PER_ITEM_SECONDS` each to the total time.
   * @type {import('vue').ComputedRef<number>}
   */
  const rawItemCount = computed(
    () => listStore.items.filter((i) => i.type === 'raw' || !i.supermarket).length,
  )

  /**
   * Estimated stay duration per group key (supermarket id or `__raw__`), in
   * seconds. Supermarket groups receive the base stay + per-item time; the
   * raw group only receives per-item time.
   * @type {import('vue').ComputedRef<Record<string, number>>}
   */
  const groupTimes = computed(() => {
    /** @type {Record<string, number>} */
    const times = {}
    for (const group of listStore.groupedItems) {
      const itemCount = group.items.reduce((sum, i) => sum + (i.quantity ?? 1), 0)
      if (group.supermarket === '__raw__') {
        times[group.supermarket] = itemCount * PER_ITEM_SECONDS
      } else {
        times[group.supermarket] = BASE_STAY_SECONDS + itemCount * PER_ITEM_SECONDS
      }
    }
    return times
  })

  /**
   * Set of supermarket ids that are actually "visited" — i.e. that have at
   * least one specific product on the shopping list. Raw items (`__raw__`)
   * are excluded because they are not tied to a specific store and therefore
   * do not extend the driving route.
   * @type {import('vue').ComputedRef<string[]>}
   */
  const visitedSupermarketIds = computed(() =>
    listStore.groupedItems
      .filter((g) => g.supermarket !== '__raw__')
      .map((g) => g.supermarket)
      .sort(),
  )

  /**
   * Stable combination key for the visited supermarkets (sorted ids joined
   * by `+`). Matches the `id` field of the route options produced by the
   * discovery pipeline.
   * @type {import('vue').ComputedRef<string>}
   */
  const visitedCombinationKey = computed(() => visitedSupermarketIds.value.join('+'))

  /**
   * The discovered route that exactly matches the set of supermarkets the
   * user actually visits (has at least one product for). Used to derive the
   * driving duration that reflects only the stores really being driven to.
   *
   * Falls back to `null` when no matching route exists (e.g. the visited
   * combination was not part of the discovery result, or no discovery has
   * been run yet).
   * @type {import('vue').ComputedRef<object|null>}
   */
  const visitedRoute = computed(() => {
    if (visitedCombinationKey.value.length === 0) return null
    return marketStore.lastRoutes.find((r) => r.id === visitedCombinationKey.value) ?? null
  })

  /**
   * Driving duration (in seconds) for the route covering only the
   * supermarkets that are actually visited (at least one product bought).
   * When no matching route is available, this falls back to the persisted
   * `routeDuration` of the full selected combination so the estimate degrades
   * gracefully.
   * @type {import('vue').ComputedRef<number>}
   */
  const drivingDuration = computed(() => {
    if (visitedRoute.value) return visitedRoute.value.totalDuration ?? 0
    return marketStore.routeDuration ?? 0
  })

  /**
   * Estimated total shopping time in seconds: driving duration + the sum of
   * all group stay durations.
   *
   * The driving duration reflects only the supermarkets that are actually
   * visited (i.e. have at least one product on the list), looked up from
   * the persisted discovery routes. It is only included when a
   * location-based discovery was performed and not denied. When the user
   * denied geolocation (or no discovery has been run yet), the driving
   * portion is excluded so the estimate only reflects the in-store shopping
   * time.
   * @type {import('vue').ComputedRef<number>}
   */
  const totalTime = computed(() => {
    let seconds = 0
    if (marketStore.includeDrivingTime) {
      seconds += drivingDuration.value
    }
    for (const key of Object.keys(groupTimes.value)) {
      seconds += groupTimes.value[key]
    }
    return seconds
  })

  /**
   * Whether the driving duration is included in the total time estimate.
   * Exposed so the UI can decide whether to show the "Fahrt" label.
   * @type {import('vue').ComputedRef<boolean>}
   */
  const includesDriving = computed(() => marketStore.includeDrivingTime)

  return { totalTime, groupTimes, rawItemCount, includesDriving }
}
