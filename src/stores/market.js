import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { SUPPORTED_SUPERMARKETS } from '@/utils/supermarkets'

/**
 * Pinia store that tracks the currently selected supermarkets.
 *
 * The selection is persisted to localStorage via VueUse's `useLocalStorage`
 * so that the user's preferred supermarkets survive page reloads. When the
 * stored selection is empty, the UI automatically prompts the user to pick
 * at least one supermarket.
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
  }

  return {
    selectedMarkets,
    filterExpression,
    hasSelection,
    setMarkets,
    toggleMarket,
    clearMarkets,
  }
})

export { SUPPORTED_SUPERMARKETS }
