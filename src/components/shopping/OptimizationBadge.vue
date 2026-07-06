<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { formatBasePrice } from '@/utils/format'

/**
 * Inline optimization badge/tag rendered inside a shopping list item.
 *
 * Two variants are supported depending on the optimization flow. Both use
 * the same compact DaisyUI `badge` styling so they look consistent:
 *
 * - **`other`** ("Other" category mapping): shows the cheapest base price
 *   found across all supermarkets. Format: "ab €[Price]/[Unit]".
 *
 * - **`price`** (supermarket-specific price optimization): shows the
 *   maximum savings percentage. Format: "BIS -[X]%/[Unit]".
 *
 * Clicking the badge emits `open` so the parent can show the selection
 * dialog with all alternatives.
 *
 * @prop {'other'|'price'} kind - Which optimization flow the badge belongs to.
 * @prop {object} result - The `OptimizationResult` from `useOptimization`.
 */
const props = defineProps({
  kind: { type: String, required: true },
  result: { type: Object, required: true },
})

const emit = defineEmits(['open'])

/** @type {import('vue').ComputedRef<object>} Cheapest alternative product. */
const cheapest = computed(() => props.result.cheapest)

/** @type {import('vue').ComputedRef<string>} Formatted cheapest base price. */
const priceLabel = computed(() =>
  formatBasePrice(cheapest.value?.basePrice, cheapest.value?.baseUnit),
)

/** @type {import('vue').ComputedRef<number>} Savings percentage (price flow). */
const savingsPercent = computed(() => props.result.savingsPercent ?? 0)

/**
 * Extract a short unit token from the `baseUnit` string. Typesense stores
 * values like "1 KG", "1 Liter", "1 Stück" — this strips the leading
 * quantity and returns just the unit part ("KG", "Liter", "Stück").
 * @type {import('vue').ComputedRef<string>}
 */
const shortUnit = computed(() => {
  const raw = cheapest.value?.baseUnit ?? ''
  // Remove leading numbers and whitespace, keep the rest.
  return raw.replace(/^\d+\s*/i, '').trim() || raw
})
</script>

<template>
  <!-- "Other" flow: compact badge with the cheapest base price -->
  <button
    v-if="kind === 'other' && cheapest"
    type="button"
    class="btn btn-sm btn-accent gap-1 shrink-0 cursor-pointer whitespace-nowrap"
    @click="emit('open')"
  >
    <Icon icon="lucide:tag" width="12" height="12" />
    <span>Ab {{ priceLabel }}</span>
  </button>

  <!-- "Price" flow: compact savings badge -->
  <button
    v-else-if="kind === 'price'"
    type="button"
    class="btn btn-sm btn-accent gap-1 shrink-0 cursor-pointer whitespace-nowrap"
    @click="emit('open')"
  >
    <Icon icon="lucide:trending-down" width="12" height="12" />
    <span>Bis -{{ savingsPercent }}% / {{ shortUnit }}</span>
  </button>
</template>
