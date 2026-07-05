<script setup>
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { supermarketLabel } from '@/utils/supermarkets'

/**
 * Single selectable route option card.
 *
 * Displays the ordered list of supermarkets on a calculated route, the total
 * driving distance and a select button. Emits `select` when the user picks
 * this route.
 *
 * @prop {Object} route - Route option (see `useSupermarketDiscovery`).
 * @prop {boolean} selected - Whether this route is currently highlighted.
 */
const props = defineProps({
  route: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})
const emit = defineEmits(['select', 'hover'])

/** @type {import('vue').ComputedRef<string>} Human readable total distance. */
const distanceLabel = computed(() => {
  const m = props.route.totalDistance
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${Math.round(m)} m`
})

/** @type {import('vue').ComputedRef<string[]>} Ordered supermarket labels. */
const stopLabels = computed(() => props.route.stops.map((s) => supermarketLabel(s.supermarketId)))
</script>

<template>
  <button
    type="button"
    class="w-full text-left rounded-box border p-3 transition-colors"
    :class="selected ? 'border-primary bg-primary/10' : 'border-base-300 hover:bg-base-200'"
    @click="emit('select', route)"
    @mouseenter="emit('hover', route)"
    @mouseleave="emit('hover', null)"
  >
    <div class="flex items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-1 text-sm">
        <Icon icon="lucide:home" width="14" class="text-base-content/60" />
        <template v-for="(label, i) in stopLabels" :key="i">
          <Icon icon="lucide:chevron-right" width="12" class="text-base-content/40" />
          <span class="font-medium">{{ label }}</span>
        </template>
        <Icon icon="lucide:chevron-right" width="12" class="text-base-content/40" />
        <Icon icon="lucide:home" width="14" class="text-base-content/60" />
      </div>
      <span class="badge badge-sm badge-ghost whitespace-nowrap">{{ distanceLabel }}</span>
    </div>
  </button>
</template>
