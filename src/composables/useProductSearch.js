import { ref, computed, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import * as Typesense from 'typesense'
import { useMarketStore } from '@/stores/market'

/**
 * @typedef {Object} SearchSuggestion
 * @property {'raw'|'product'} type - Whether this is the raw text fallback
 *   or a real Typesense product document.
 * @property {string} name - Display name for the suggestion.
 * @property {object} [product] - The original Typesense document (products only).
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
 * Composable that performs an incremental, debounced Typesense search for
 * products. The very first suggestion returned is always a raw text fallback
 * matching exactly what the user typed (so they can add custom items that
 * are not present in the database).
 *
 * The active supermarket filter from `useMarketStore` is automatically
 * injected into every query. Results are sorted by `basePrice` ascending so
 * the cheapest product per kilogram/liter is shown first.
 *
 * The `searchQuery` ref is owned by the calling component and passed in so
 * the caller stays in control of the input value (e.g. to reset it after a
 * selection).
 *
 * @param {import('vue').Ref<string>} searchQuery - Reactive search input
 *   value owned by the caller.
 * @returns {object} Reactive search state and the `performSearch` trigger.
 */
export function useProductSearch(searchQuery) {
  /** @type {import('vue').Ref<SearchSuggestion[]>} Suggestion list. */
  const suggestions = ref([])
  /** @type {import('vue').Ref<boolean>} Loading indicator. */
  const isLoading = ref(false)
  /** @type {import('vue').Ref<string|null>} Error message, if any. */
  const error = ref(null)

  const marketStore = useMarketStore()

  /** @type {import('vue').ComputedRef<string>} Active filter_by expression. */
  const filterBy = computed(() => marketStore.filterExpression)

  /**
   * Execute a search against Typesense using the current `searchQuery`.
   * When the query is empty the suggestion list is cleared. The first
   * suggestion is always the raw text fallback.
   * @returns {Promise<void>}
   */
  async function performSearch() {
    const query = searchQuery.value.trim()
    if (!query) {
      suggestions.value = []
      return
    }

    isLoading.value = true
    error.value = null

    try {
      /** @type {object} */
      const searchParams = {
        q: query,
        query_by: 'name,brand,supermarket,genericCategory',
        sort_by: 'basePrice:asc,_text_match:desc',
        per_page: 12,
      }
      if (filterBy.value) searchParams.filter_by = filterBy.value

      const response = await client.collections(COLLECTION_NAME).documents().search(searchParams)

      /** @type {SearchSuggestion[]} */
      const mapped = response.hits.map((hit) => ({
        type: 'product',
        name: hit.document.name,
        product: hit.document,
      }))

      // The raw text fallback is always the very first suggestion.
      suggestions.value = [{ type: 'raw', name: query }, ...mapped]
    } catch (err) {
      error.value = err?.message ?? 'Suche fehlgeschlagen'
      // Still provide the raw fallback so the user can add the item manually.
      suggestions.value = [{ type: 'raw', name: query }]
    } finally {
      isLoading.value = false
    }
  }

  // Debounced trigger: 300ms after the user stops typing.
  watchDebounced(searchQuery, performSearch, { debounce: 300 })

  // Re-run the search whenever the supermarket selection changes so the
  // suggestions stay in sync with the active filters.
  watch(filterBy, () => {
    if (searchQuery.value.trim()) performSearch()
  })

  return {
    suggestions,
    isLoading,
    error,
    performSearch,
  }
}
