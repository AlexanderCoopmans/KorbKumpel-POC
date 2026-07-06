import { ref, computed } from 'vue'
import * as Typesense from 'typesense'
import { useShoppingListStore } from '@/stores/shoppingList'

/**
 * @file AI-driven shopping list optimization.
 *
 * Implements the two optimization flows described in the PRS:
 *
 * 1. **"Other" category mapping** — items that are raw text entries or
 *    products without a supermarket are matched against the Typesense
 *    product database using their `genericCategory` and `brand`. The
 *    cheapest match across all supermarkets is surfaced as a tag inside
 *    the list item ("Available at [Supermarket] from €[Price]/[Base Unit]").
 *
 * 2. **Supermarket-specific price optimization** — items already assigned to
 *    a supermarket are re-queried by `genericCategory` with a strict
 *    `baseUnit` match constraint. When a cheaper `basePrice` exists, a
 *    badge "Save up to [X]% per [Base Unit]" is shown next to the price.
 *
 * Rejections are persisted in-memory for the current optimization run. They
 * are cleared the next time `runOptimization` is invoked, so previously
 * dismissed suggestions can reappear if they are still the best match.
 */

/** Singleton Typesense client shared across all composable instances. */
const client = new Typesense.Client({
  nodes: [
    {
      host: 'hb4clu17mntqvzp6p-1.a2.typesense.net',
      port: '443',
      protocol: 'https',
    },
  ],
  apiKey: 'pm1SMAkPkSZ5jJfG5cvEIHBzP4KfriXl',
  connectionTimeoutSeconds: 2,
})

/** Name of the Typesense collection that holds the product documents. */
const COLLECTION_NAME = 'products'

/**
 * @typedef {Object} OptimizationResult
 * @property {string} uid - The shopping list item uid this result belongs to.
 * @property {'other'|'price'} kind - Which optimization flow produced it.
 * @property {object[]} alternatives - All matching Typesense products found,
 *   sorted by `basePrice` ascending (cheapest first).
 * @property {object} [cheapest] - The cheapest alternative (convenience).
 * @property {number} [savingsPercent] - For the price flow: maximum savings
 *   percentage vs. the current item's `basePrice` (0–100).
 */

// ---------------------------------------------------------------------------
// Module-scoped reactive state (singleton). Shared across every component
// that calls `useOptimization()` so the OptimizeButton trigger and the
// ShoppingListItem rows stay in sync.
// ---------------------------------------------------------------------------

/** @type {import('vue').Ref<boolean>} Whether an optimization run is in progress. */
const isLoading = ref(false)
/** @type {import('vue').Ref<string|null>} Error message, if any. */
const error = ref(null)

/**
 * Optimization results keyed by shopping list item uid. Each entry is an
 * `OptimizationResult`. Items without a result are not optimized.
 * @type {import('vue').Ref<Record<string, OptimizationResult>>}
 */
const results = ref({})

/**
 * Set of item uids whose suggestion the user has rejected/dismissed during
 * the current optimization run. Re-running `runOptimization` clears this
 * set so previously rejected suggestions can reappear.
 * @type {import('vue').Ref<Set<string>>}
 */
const rejected = ref(new Set())

/** @type {import('vue').ComputedRef<boolean>} Whether any results exist. */
const hasResults = computed(() => Object.keys(results.value).length > 0)

/**
 * Composable that runs the shopping list optimization and exposes the
 * per-item results so list rows can render badges/tags and open the
 * selection dialog.
 *
 * The reactive state is hoisted to module scope so that every component
 * calling `useOptimization()` shares the same `results`, `rejected` and
 * loading flags. This lets the `OptimizeButton` trigger a run while the
 * `ShoppingListItem` rows reactively render the resulting badges.
 *
 * @returns {object} Optimization state and the `runOptimization` trigger.
 */
export function useOptimization() {
  const listStore = useShoppingListStore()

  /**
   * Wrap a string value in Typesense backtick syntax for use in `filter_by`
   * expressions. Typesense expects string values to be backtick-quoted
   * (not double-quoted). Any backtick inside the value is escaped with `\\`.
   *
   * @param {string} value - The raw string value.
   * @returns {string} Backtick-wrapped value ready for `filter_by`.
   */
  function tsValue(value) {
    return '`' + String(value).replace(/`/g, '\\`') + '`'
  }

  /**
   * Build a Typesense `filter_by` expression that matches the given
   * `genericCategory` (and optionally `brand`) across all supermarkets.
   * @param {string} genericCategory - The generic category to match.
   * @param {string} [brand] - Optional brand to narrow the match.
   * @returns {string} A Typesense filter_by expression.
   */
  function buildCategoryFilter(genericCategory, brand) {
    /** @type {string[]} */
    const parts = [`genericCategory:=${tsValue(genericCategory)}`]
    if (brand && brand.trim()) {
      parts.push(`brand:=${tsValue(brand.trim())}`)
    }
    return parts.join(' && ')
  }

  /**
   * Build a Typesense `filter_by` expression for the price-optimization
   * flow. Matches the `genericCategory` and the exact `baseUnit`.
   *
   * The current supermarket is **not** excluded because the PRS asks for
   * cheaper alternatives regardless of which supermarket offers them —
   * the same supermarket may carry a cheaper product in the same category.
   *
   * @param {string} genericCategory - The generic category to match.
   * @param {string} baseUnit - The exact base unit to match.
   * @returns {string} A Typesense filter_by expression.
   */
  function buildPriceFilter(genericCategory, baseUnit) {
    return [`genericCategory:=${tsValue(genericCategory)}`, `baseUnit:=${tsValue(baseUnit)}`].join(
      ' && ',
    )
  }

  /**
   * Execute a Typesense search and return the matched documents sorted by
   * `basePrice` ascending. Returns an empty array on error.
   *
   * @param {object} params - Search parameters.
   * @param {string} params.q - The query string.
   * @param {string} params.queryBy - Comma-separated fields to match.
   * @param {string} [params.filterBy] - Optional filter_by expression.
   * @param {number} [params.perPage=24] - Number of results to request.
   * @returns {Promise<object[]>} Matched product documents.
   */
  async function searchProducts({ q, queryBy, filterBy, perPage = 24 }) {
    /** @type {object} */
    const searchParams = {
      q,
      query_by: queryBy,
      sort_by: 'basePrice:asc,_text_match:desc',
      per_page: perPage,
    }
    if (filterBy) searchParams.filter_by = filterBy

    const response = await client.collections(COLLECTION_NAME).documents().search(searchParams)
    return response.hits.map((hit) => hit.document)
  }

  /**
   * Optimize a single "Other" category item (raw text or product without a
   * supermarket). Searches Typesense by `genericCategory` + `brand` and
   * records the cheapest match.
   *
   * @param {object} item - The shopping list item to optimize.
   * @returns {Promise<OptimizationResult|null>}
   */
  async function optimizeOtherItem(item) {
    // Raw text items have no category/brand metadata, so we use the item
    // name as a fuzzy text query against the product name field. This is
    // the "AI analyzes existing product database entries to understand text
    // naming patterns" fallback described in the PRS.
    if (item.type === 'raw' || !item.genericCategory) {
      const docs = await searchProducts({
        q: item.name,
        queryBy: 'genericCategory,name,brand',
        perPage: 24,
      })
      if (docs.length === 0) return null
      return {
        uid: item.uid,
        kind: 'other',
        alternatives: docs,
        cheapest: docs[0],
      }
    }

    const docs = await searchProducts({
      q: '*',
      queryBy: 'name,brand,genericCategory',
      filterBy: buildCategoryFilter(item.genericCategory, item.brand),
      perPage: 24,
    })
    if (docs.length === 0) return null
    return {
      uid: item.uid,
      kind: 'other',
      alternatives: docs,
      cheapest: docs[0],
    }
  }

  /**
   * Optimize a single supermarket-assigned item. Searches Typesense by
   * `genericCategory` with a strict `baseUnit` match and computes the
   * maximum savings percentage vs. the current item's `basePrice`.
   *
   * @param {object} item - The shopping list item to optimize.
   * @returns {Promise<OptimizationResult|null>}
   */
  async function optimizePriceItem(item) {
    if (!item.genericCategory || !item.baseUnit || item.basePrice == null) return null

    const docs = await searchProducts({
      q: '*',
      queryBy: 'name,brand,genericCategory',
      filterBy: buildPriceFilter(item.genericCategory, item.baseUnit),
      perPage: 24,
    })
    if (docs.length === 0) return null

    // Only consider strictly cheaper alternatives.
    const cheaper = docs.filter(
      (d) => typeof d.basePrice === 'number' && d.basePrice < item.basePrice,
    )
    if (cheaper.length === 0) return null

    const cheapest = cheaper[0]
    const savingsPercent = Math.round(
      ((item.basePrice - cheapest.basePrice) / item.basePrice) * 100,
    )

    return {
      uid: item.uid,
      kind: 'price',
      alternatives: cheaper,
      cheapest,
      savingsPercent: Math.max(0, savingsPercent),
    }
  }

  /**
   * Run the optimization for every item on the shopping list. Clears any
   * previous results and rejections so previously dismissed suggestions can
   * reappear if they are still the best match.
   *
   * @returns {Promise<void>}
   */
  async function runOptimization() {
    isLoading.value = true
    error.value = null
    results.value = {}
    rejected.value = new Set()

    try {
      /** @type {Promise<OptimizationResult|null>[]} */
      const tasks = listStore.items.map((item) => {
        // "Other" flow: raw text items or products without a supermarket.
        if (item.type === 'raw' || !item.supermarket) {
          return optimizeOtherItem(item)
        }
        // Price flow: products already assigned to a supermarket.
        return optimizePriceItem(item)
      })

      const settled = await Promise.allSettled(tasks)
      /** @type {Record<string, OptimizationResult>} */
      const next = {}
      for (const res of settled) {
        if (res.status === 'fulfilled' && res.value) {
          next[res.value.uid] = res.value
        }
      }
      results.value = next
    } catch (err) {
      error.value = err?.message ?? 'Optimierung fehlgeschlagen'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Mark a suggestion as rejected/dismissed for the current run. The
   * corresponding result is removed from the active results so the
   * badge/tag disappears from the list.
   * @param {string} uid - The shopping list item uid.
   */
  function rejectSuggestion(uid) {
    rejected.value.add(uid)
    const next = { ...results.value }
    delete next[uid]
    results.value = next
  }

  /**
   * Get the optimization result for a given item uid, or `null` when no
   * result is available (or it was rejected).
   * @param {string} uid - The shopping list item uid.
   * @returns {OptimizationResult|null}
   */
  function getResult(uid) {
    return results.value[uid] ?? null
  }

  return {
    isLoading,
    error,
    results,
    hasResults,
    rejected,
    runOptimization,
    rejectSuggestion,
    getResult,
  }
}
