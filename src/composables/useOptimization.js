import { ref } from 'vue'
import * as Typesense from 'typesense'
import { useMarketStore } from '@/stores/market'
import { useShoppingListStore } from '@/stores/shoppingList'

/** Singleton Typesense client (shared with the search composable). */
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
 * Composable that powers the "Einkaufsliste optimieren" feature.
 *
 * For every product on the shopping list it runs two comparison queries
 * against Typesense:
 *
 * 1. **Specific Product Match** – searches for the same item name across all
 *    other selected supermarkets (the `supermarket` field is excluded from the
 *    text search but the active supermarket filter is kept).
 * 2. **Brand-Agnostic Generic Search** – strips the brand from the query and
 *    searches for generic / store-brand alternatives.
 *
 * The cheapest alternative (by `basePrice`) that is cheaper than the current
 * item is stored on the shopping list item as `optimization`.
 *
 * @returns {object} Reactive state and the `optimize` action.
 */
export function useOptimization() {
  /** @type {import('vue').Ref<boolean>} Whether an optimization run is in progress. */
  const isOptimizing = ref(false)
  /** @type {import('vue').Ref<string|null>} Error message, if any. */
  const error = ref(null)
  /** @type {import('vue').Ref<number>} Number of items that have a cheaper alternative. */
  const alternativesFound = ref(0)

  const marketStore = useMarketStore()
  const listStore = useShoppingListStore()

  /**
   * Run a single Typesense search query.
   * @param {object} params - Search parameters.
   * @returns {Promise<object[]>} Array of product documents.
   */
  async function runQuery(params) {
    const response = await client.collections(COLLECTION_NAME).documents().search(params)
    return response.hits.map((hit) => hit.document)
  }

  /**
   * Find the cheapest alternative for a single shopping list item.
   * @param {object} item - A shopping list item (must be of type 'product').
   * @returns {Promise<object|null>} The optimization result or null.
   */
  async function optimizeItem(item) {
    const filterBy = marketStore.filterExpression
    const baseParams = {
      q: item.name,
      query_by: 'name,brand,supermarket',
      sort_by: 'basePrice:asc,_text_match:desc',
      per_page: 10,
    }
    if (filterBy) baseParams.filter_by = filterBy

    // 1. Specific product match across all selected supermarkets.
    let candidates = await runQuery(baseParams)

    // 2. Brand-agnostic generic search: drop the brand from the query_by so
    //    store-brand / generic products can surface.
    if (item.brand) {
      const genericParams = {
        ...baseParams,
        query_by: 'name,supermarket',
      }
      const generic = await runQuery(genericParams)
      candidates = [...candidates, ...generic]
    }

    // Filter out the exact same product (same gtin or same name+supermarket).
    const filtered = candidates.filter((doc) => {
      if (item.gtin && doc.gtin && doc.gtin === item.gtin) return false
      if (doc.name === item.name && doc.supermarket === item.supermarket) return false
      return true
    })

    if (filtered.length === 0) return null

    // Pick the cheapest alternative by basePrice.
    const cheapest = filtered.reduce((best, doc) => {
      if (!best) return doc
      return Number(doc.basePrice) < Number(best.basePrice) ? doc : best
    }, null)

    if (!cheapest) return null

    const currentBase = Number(item.basePrice ?? Infinity)
    const altBase = Number(cheapest.basePrice)
    if (!Number.isFinite(altBase) || altBase >= currentBase) return null

    const matchType =
      cheapest.brand && item.brand && cheapest.brand === item.brand ? 'specific' : 'generic'

    return {
      hasAlternative: true,
      alternative: {
        name: cheapest.name,
        brand: cheapest.brand ?? null,
        imageUrl: cheapest.imageUrl ?? null,
        retailPrice: Number(cheapest.retailPrice),
        basePrice: Number(cheapest.basePrice),
        baseUnit: cheapest.baseUnit ?? '',
        supermarket: cheapest.supermarket,
        savings: currentBase - altBase,
        matchType,
      },
    }
  }

  /**
   * Run the optimization for every product item on the shopping list.
   * Raw text items are skipped because they have no price to compare.
   * @returns {Promise<void>}
   */
  async function optimize() {
    isOptimizing.value = true
    error.value = null
    alternativesFound.value = 0
    listStore.clearOptimizations()

    try {
      const productItems = listStore.items.filter((i) => i.type === 'product')

      // Run queries sequentially to avoid hammering the Typesense cluster.
      for (const item of productItems) {
        try {
          const result = await optimizeItem(item)
          if (result) {
            listStore.setOptimization(item.uid, result)
            alternativesFound.value += 1
          } else {
            listStore.setOptimization(item.uid, { hasAlternative: false, alternative: null })
          }
        } catch (err) {
          // A single item failure should not abort the whole run.
          listStore.setOptimization(item.uid, { hasAlternative: false, alternative: null })
        }
      }
    } catch (err) {
      error.value = err?.message ?? 'Optimierung fehlgeschlagen'
    } finally {
      isOptimizing.value = false
    }
  }

  return {
    isOptimizing,
    error,
    alternativesFound,
    optimize,
  }
}
