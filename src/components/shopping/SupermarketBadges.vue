<script setup>
import { computed } from 'vue'
import { supermarketLabel } from '@/utils/supermarkets'

/**
 * Clickable supermarket badges for combination selection.
 *
 * Renders one badge per supermarket id found in the provided routes. Clicking
 * a badge toggles its membership in the working selection. Each badge shows
 * the additional driving distance incurred by adding that supermarket to the
 * current selection (marginal cost).
 *
 * @prop {string[]} available - All supermarket ids that appear in any route.
 * @prop {string[]} selected - Currently selected supermarket ids (working copy).
 * @prop {Record<string, number|null>} marginalCosts - Map of supermarket id
 *   to additional distance in meters (or null when no valid route exists).
 * @prop {Record<string, number|null>} marginalDurations - Map of supermarket
 *   id to additional duration in seconds (or null when no valid route exists).
 * @prop {boolean} showCosts - Whether to display the marginal cost labels.
 */
const props = defineProps({
  available: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  marginalCosts: { type: Object, default: () => ({}) },
  marginalDurations: { type: Object, default: () => ({}) },
  showCosts: { type: Boolean, default: false },
})
const emit = defineEmits(['toggle'])

/**
 * Format a duration in seconds as a compact string (e.g. "5 min").
 * @param {number|null} s - Duration in seconds.
 * @returns {string}
 */
function formatDuration(s) {
  if (s == null) return '—'
  const seconds = Math.round(s)
  if (seconds < 60) return `+${seconds} s`
  const m = Math.round(seconds / 60)
  return `+${m} min`
}

/**
 * Format a distance in meters as a compact string (e.g. "1 km").
 * @param {number|null} m - Distance in meters.
 * @returns {string}
 */
function formatDistance(m) {
  if (m == null) return '—'
  if (m >= 1000) return `+${(m / 1000).toFixed(1)} km`
  return `+${Math.round(m)} m`
}

/** @type {import('vue').ComputedRef<{id: string, label: string, active: boolean, cost: number|null, duration: number|null}[]>} */
const badges = computed(() =>
  props.available.map((id) => ({
    id,
    label: supermarketLabel(id),
    active: props.selected.includes(id),
    cost: props.marginalCosts[id] ?? null,
    duration: props.marginalDurations[id] ?? null,
  })),
)

/**
 * Toggle a supermarket id in the working selection.
 * @param {string} id
 */
function toggle(id) {
  emit('toggle', id)
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="badge in badges"
      :key="badge.id"
      type="button"
      class="badge badge-lg gap-1 cursor-pointer transition-colors"
      :class="badge.active ? 'badge-primary' : 'badge-outline'"
      @click="toggle(badge.id)"
    >
      <span v-if="badge.active" class="text-xs">✓</span>
      {{ badge.label }}
      <span v-if="showCosts && !badge.active" class="text-xs opacity-70">
        {{ formatDuration(badge.duration) }} ({{ formatDistance(badge.cost) }})
      </span>
    </button>
  </div>
</template>
