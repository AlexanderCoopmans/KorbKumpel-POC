<script setup>
/**
 * Single offer card for horizontal scrolling lists.
 *
 * Displays a product image, discount badge, name, brand and price.
 *
 * @typedef {Object} Offer
 * @property {string} name - Product name.
 * @property {string} [brand] - Product brand.
 * @property {string} image - Product image URL.
 * @property {string} [discount] - Discount label, e.g. "-20%".
 * @property {string} price - Current price string.
 * @property {string} [oldPrice] - Strikethrough old price string.
 * @property {string} [unit] - Unit reference, e.g. "100g".
 */

/** @type {{ offer: Offer }} */
defineProps({
  offer: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <article class="card bg-base-100 w-36 flex-shrink-0 shadow-sm border border-base-200">
    <figure class="relative h-28 bg-base-200 overflow-hidden">
      <img
        :src="offer.image"
        :alt="offer.name"
        class="h-full w-full object-cover object-center"
        loading="lazy"
      />
      <span
        v-if="offer.discount"
        class="absolute top-2 left-2 badge badge-accent badge-sm font-semibold border border-white"
      >
        {{ offer.discount }}
      </span>
    </figure>
    <div class="card-body p-3 gap-1">
      <h4 class="text-sm font-semibold leading-tight line-clamp-2">{{ offer.name }}</h4>
      <p v-if="offer.brand" class="text-xs text-base-content/60 truncate">{{ offer.brand }}</p>
      <div class="flex items-end gap-2 mt-1">
        <span class="text-base font-bold text-primary">{{ offer.price }}</span>
        <span v-if="offer.oldPrice" class="text-xs text-base-content/40 line-through">
          {{ offer.oldPrice }}
        </span>
      </div>
      <p v-if="offer.unit" class="text-xs text-base-content/50">{{ offer.unit }}</p>
    </div>
  </article>
</template>
