<script setup>
/**
 * Circular market chip for the favorite supermarkets section.
 *
 * @typedef {Object} Market
 * @property {string} id - Supermarket identifier.
 * @property {string} label - Display name.
 * @property {string} [image] - Optional logo URL.
 * @property {string} [color] - Optional background color class.
 */

/** @type {{ market: Market }} */
defineProps({
  market: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <button type="button" class="flex flex-col items-center gap-2 flex-shrink-0 w-20 snap-start">
    <div
      class="w-16 h-16 rounded-full flex items-center justify-center shadow-sm border border-base-200"
      :class="market.color || 'bg-base-100'"
    >
      <img
        v-if="market.image"
        :src="market.image"
        :alt="market.label"
        class="w-10 h-10 object-contain"
        loading="lazy"
      />
      <span v-else class="text-lg font-bold text-primary">{{ market.label.charAt(0) }}</span>
    </div>
    <span class="text-xs text-center leading-tight text-base-content/80">{{ market.label }}</span>
  </button>
</template>
