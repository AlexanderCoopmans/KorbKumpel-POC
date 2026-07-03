import { ref, watch } from 'vue'
import { watchDebounced, useAsyncState } from '@vueuse/core'
import * as Typesense from 'typesense'

export function useTypesense(options = {}) {
  // 1. Client configuration
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

  const collectionName = 'products'

  // 2. Reactive parameters mapped to your UI
  const searchQuery = ref('')
  const page = ref(1)
  const perPage = ref(options.perPage || 12)

  // Make these reactive so the UI dropdowns can update them
  const queryBy = ref(options.queryBy || 'name,brand')
  const sortBy = ref(options.sortBy || '') // e.g., 'basePrice:asc,_text_match:desc'
  const filterBy = ref(options.filterBy || '') // e.g., 'supermarket: [Aldi, Lidl]'
  const facetBy = ref(options.facetBy || '') // e.g., 'supermarket'
  const groupBy = ref(options.groupBy || '')

  const totalHits = ref(0)
  const totalPages = ref(0)

  // 3. VueUse Magic: useAsyncState handles loading, error & state management
  const {
    state: results,
    isLoading,
    error,
    execute: performSearch,
  } = useAsyncState(
    async () => {
      // Return an empty array if the search field is empty
      if (!searchQuery.value.trim()) {
        totalHits.value = 0
        totalPages.value = 0
        return []
      }

      // Base search parameters
      const searchParams = {
        q: searchQuery.value,
        query_by: queryBy.value,
        page: page.value,
        per_page: perPage.value,
      }

      // Dynamically append optional parameters if they have values
      if (sortBy.value) searchParams.sort_by = sortBy.value
      if (filterBy.value) searchParams.filter_by = filterBy.value
      if (facetBy.value) searchParams.facet_by = facetBy.value
      if (groupBy.value) searchParams.group_by = groupBy.value

      const response = await client.collections(collectionName).documents().search(searchParams)

      // Update metadata
      totalHits.value = response.found
      totalPages.value = Math.ceil(response.found / perPage.value)

      // Return the mapped documents. They are automatically stored in "results" (state).
      // Note: If you use group_by, the response structure changes to response.grouped_hits!
      if (groupBy.value && response.grouped_hits) {
        return response.grouped_hits
      }

      return response.hits.map((hit) => hit.document)
    },
    [], // Initial value for "results" (empty array)
    { immediate: false }, // Do not execute immediately on mount
  )

  // 4. VueUse: watchDebounced for the search bar (300ms delay)
  watchDebounced(
    searchQuery,
    () => {
      // Reset to page 1 when a new term is searched
      if (page.value !== 1) {
        page.value = 1
      } else {
        performSearch()
      }
    },
    { debounce: 300 },
  )

  // 5. Watcher for all UI controls (Sorting, Filtering, Grouping)
  // If any of these change, we want to update the search and reset the page
  watch([sortBy, filterBy, facetBy, queryBy, groupBy], () => {
    if (page.value !== 1) {
      page.value = 1
    } else {
      performSearch()
    }
  })

  // 6. Normal watcher for pagination (immediate execution)
  watch(page, () => {
    performSearch()
  })

  // Helper function for pagination
  const setPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages.value) {
      page.value = newPage
    }
  }

  return {
    searchQuery,
    results,
    isLoading,
    error,
    page,
    totalPages,
    totalHits,
    // Expose all reactive UI states
    queryBy,
    sortBy,
    filterBy,
    facetBy,
    groupBy,
    setPage,
    performSearch,
  }
}
