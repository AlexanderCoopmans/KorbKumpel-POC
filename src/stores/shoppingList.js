import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'

/**
 * @typedef {Object} ShoppingListItem
 * @property {string} uid - Unique client side id (crypto.randomUUID).
 * @property {'product'|'raw'} type - Whether the item is a real product from
 *   Typesense or a plain text fallback entered by the user.
 * @property {string} name - Display name of the item.
 * @property {string} [brand] - Optional brand name (products only).
 * @property {string} [imageUrl] - Optional product image URL.
 * @property {number} [retailPrice] - Retail price in cents (products only).
 * @property {number} [basePrice] - Base price in cents (products only).
 * @property {string} [baseUnit] - Base unit description (products only).
 * @property {string} [supermarket] - Supermarket id (products only).
 * @property {string} [gtin] - GTIN / EAN code (products only).
 * @property {boolean} checked - Whether the item is marked as bought.
 * @property {number} quantity - How many of this item should be bought (>= 1).
 * @property {object|null} optimization - Result of the optimization engine.
 *   `null` when no optimization has been run yet.
 */

/**
 * @typedef {Object} OptimizationAlternative
 * @property {string} name - Name of the alternative product.
 * @property {string} [brand] - Brand of the alternative.
 * @property {string} [imageUrl] - Image URL of the alternative.
 * @property {number} retailPrice - Retail price in cents.
 * @property {number} basePrice - Base price in cents.
 * @property {string} baseUnit - Base unit description.
 * @property {string} supermarket - Supermarket id.
 * @property {number} savings - Absolute savings in cents vs. current item.
 * @property {'specific'|'generic'} matchType - How the alternative was found.
 */

/**
 * @typedef {Object} OptimizationResult
 * @property {boolean} hasAlternative - Whether a cheaper alternative exists.
 * @property {OptimizationAlternative|null} alternative - The best alternative.
 */

/**
 * Pinia store managing the active shopping list.
 *
 * The list is persisted to localStorage via VueUse `useLocalStorage` so that
 * the user does not lose their items on a page reload. Optimization results
 * are kept alongside the items but are considered temporary and can be
 * cleared with `clearOptimizations`.
 *
 * @returns {object} Store state, getters and actions.
 */
export const useShoppingListStore = defineStore('shoppingList', () => {
  /**
   * Persisted list of shopping list items.
   * @type {import('@vueuse/core').RemovableRef<ShoppingListItem[]>}
   */
  const items = useLocalStorage('korbkumpel.shoppingList', [])

  /**
   * Computed total retail price of all (non-raw) items in cents.
   * Raw text items do not have a price and are ignored. The price of each
   * item is multiplied by its `quantity`.
   * @type {import('vue').ComputedRef<number>}
   */
  const totalPrice = computed(() =>
    items.value.reduce(
      (sum, item) =>
        sum + (typeof item.retailPrice === 'number' ? item.retailPrice * (item.quantity ?? 1) : 0),
      0,
    ),
  )

  /** @type {import('vue').ComputedRef<number>} Number of items on the list. */
  const itemCount = computed(() => items.value.length)

  /**
   * Total quantity across all items (sum of every item's `quantity`).
   * Falls back to 1 for legacy items without a `quantity` field.
   * @type {import('vue').ComputedRef<number>}
   */
  const totalQuantity = computed(() =>
    items.value.reduce((sum, item) => sum + (item.quantity ?? 1), 0),
  )

  /** @type {import('vue').ComputedRef<number>} Number of checked (bought) items. */
  const checkedCount = computed(() => items.value.filter((i) => i.checked).length)

  /**
   * Items grouped by their supermarket id. Raw text items are collected under
   * the special key `__raw__`. The returned array preserves the insertion
   * order of the groups.
   * @type {import('vue').ComputedRef<{supermarket: string, label: string, items: ShoppingListItem[]}[]>}
   */
  const groupedItems = computed(() => {
    const groups = new Map()
    for (const item of items.value) {
      const key = item.supermarket || '__raw__'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(item)
    }
    return Array.from(groups, ([supermarket, list]) => ({
      supermarket,
      label: supermarket === '__raw__' ? 'Sonstiges' : supermarket,
      items: list,
    }))
  })

  /**
   * Add a Typesense product document to the shopping list.
   * @param {object} product - A Typesense product document.
   * @param {number} [quantity=1] - How many of this item should be bought.
   */
  function addProduct(product, quantity = 1) {
    /** @type {ShoppingListItem} */
    const item = {
      uid: crypto.randomUUID(),
      type: 'product',
      name: product.name,
      brand: product.brand ?? null,
      imageUrl: product.imageUrl ?? null,
      retailPrice: product.retailPrice ?? null,
      basePrice: product.basePrice ?? null,
      baseUnit: product.baseUnit ?? null,
      supermarket: product.supermarket ?? null,
      gtin: product.gtin ?? null,
      checked: false,
      quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
      optimization: null,
    }
    items.value.push(item)
  }

  /**
   * Add a plain text fallback item (the raw suggestion from the search).
   * @param {string} name - The exact text the user typed.
   * @param {number} [quantity=1] - How many of this item should be bought.
   */
  function addRawItem(name, quantity = 1) {
    const trimmed = name.trim()
    if (!trimmed) return
    items.value.push({
      uid: crypto.randomUUID(),
      type: 'raw',
      name: trimmed,
      checked: false,
      quantity: Math.max(1, Math.floor(Number(quantity) || 1)),
      optimization: null,
    })
  }

  /**
   * Remove an item from the list by its uid.
   * @param {string} uid - Unique item id.
   */
  function removeItem(uid) {
    const idx = items.value.findIndex((i) => i.uid === uid)
    if (idx !== -1) items.value.splice(idx, 1)
  }

  /**
   * Toggle the checked (bought) state of an item.
   * @param {string} uid - Unique item id.
   */
  function toggleChecked(uid) {
    const item = items.value.find((i) => i.uid === uid)
    if (item) item.checked = !item.checked
  }

  /**
   * Explicitly set the checked state of an item.
   * @param {string} uid - Unique item id.
   * @param {boolean} value - New checked value.
   */
  function setChecked(uid, value) {
    const item = items.value.find((i) => i.uid === uid)
    if (item) item.checked = value
  }

  /**
   * Set the quantity of an item. Values below 1 are clamped to 1.
   * @param {string} uid - Unique item id.
   * @param {number} quantity - New quantity (>= 1).
   */
  function setQuantity(uid, quantity) {
    const item = items.value.find((i) => i.uid === uid)
    if (!item) return
    const next = Math.max(1, Math.floor(Number(quantity) || 1))
    item.quantity = next
  }

  /**
   * Replace an existing item with a cheaper alternative product.
   * The uid is preserved so the UI keeps its position; only the product
   * details are swapped. Optimization flags are reset.
   * @param {string} uid - Unique item id to replace.
   * @param {object} alternative - The alternative Typesense product document.
   */
  function swapItem(uid, alternative) {
    const item = items.value.find((i) => i.uid === uid)
    if (!item) return
    item.name = alternative.name
    item.brand = alternative.brand ?? null
    item.imageUrl = alternative.imageUrl ?? null
    item.retailPrice = alternative.retailPrice ?? null
    item.basePrice = alternative.basePrice ?? null
    item.baseUnit = alternative.baseUnit ?? null
    item.supermarket = alternative.supermarket ?? null
    item.gtin = alternative.gtin ?? null
    item.type = 'product'
    item.optimization = null
  }

  /**
   * Store the optimization result for a specific item.
   * @param {string} uid - Unique item id.
   * @param {OptimizationResult} result - The optimization result.
   */
  function setOptimization(uid, result) {
    const item = items.value.find((i) => i.uid === uid)
    if (item) item.optimization = result
  }

  /** Remove all optimization results from every item. */
  function clearOptimizations() {
    for (const item of items.value) item.optimization = null
  }

  /** Remove every item from the list. */
  function clearList() {
    items.value = []
  }

  return {
    items,
    totalPrice,
    itemCount,
    totalQuantity,
    checkedCount,
    groupedItems,
    addProduct,
    addRawItem,
    removeItem,
    toggleChecked,
    setChecked,
    setQuantity,
    swapItem,
    setOptimization,
    clearOptimizations,
    clearList,
  }
})
