<script setup>
import { computed } from 'vue'
import { supermarketLabel } from '@/utils/supermarkets'

/**
 * Clickable supermarket badges for combination selection.
 *
 * Renders one badge per supermarket id found in the provided routes. Clicking
 * a badge toggles its membership in the working selection. The selection is
 * compared against the available routes to highlight matching combinations.
 *
 * @prop {string[]} available - All supermarket ids that appear in any route.
 * @prop {string[]} selected - Currently selected supermarket ids (working copy).
 * @prop {string[]} matchedRouteIds - Route ids that match the current selection.
 * @prop {string|null} activeRouteId - The route currently highlighted on the map.
 */
const props = defineProps({
  available: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  matchedRouteIds: { type: Array, default: () => [] },
  activeRouteId: { type: String, default: null },
})
const emit = defineEmits(['toggle'])

/** @type {import('vue').ComputedRef<{id: string, label: string, active: boolean}[]>} */
const badges = computed(() =>
  props.available.map((id) => ({
    id,
    label: supermarketLabel(id),
    active: props.selected.includes(id),
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
    </button>
  </div>
</template>
