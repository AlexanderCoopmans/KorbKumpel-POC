<script setup>
import { ref } from 'vue'

/**
 * Reusable horizontal scrolling section with a title and "show all" link.
 *
 * The content is rendered through the default slot and scrolls horizontally
 * with snap points for a native mobile feel.
 *
 * @typedef {Object} Props
 * @property {string} title - Section heading.
 */

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
})

/** Reference to the scroll container for optional programmatic scrolling. */
const scrollContainer = ref(null)

/**
 * Scroll the container horizontally by a fixed amount.
 * @param {'left'|'right'} direction - Direction to scroll.
 */
function scroll(direction) {
  if (!scrollContainer.value) return
  const amount = direction === 'left' ? -200 : 200
  scrollContainer.value.scrollBy({ left: amount, behavior: 'smooth' })
}

// Expose scroll helpers for parent components if needed.
defineExpose({ scroll })
</script>

<template>
  <section>
    <div class="mb-3">
      <h3 class="text-base font-bold">{{ title }}</h3>
    </div>
    <div ref="scrollContainer" class="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
      <slot />
    </div>
  </section>
</template>

<style scoped></style>
