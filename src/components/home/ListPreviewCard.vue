<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useShoppingListStore } from '@/stores/shoppingList'

/**
 * Preview card for the current shopping list.
 *
 * Shows the list name, item count and a small basket illustration. If the
 * list is empty, a hint is displayed instead.
 */
const listStore = useShoppingListStore()

/** Number of products currently on the list. */
const count = computed(() => listStore.itemCount)

/** Label describing the amount of items. */
const countLabel = computed(() => `${count.value} Produkt${count.value === 1 ? '' : 'e'}`)
</script>

<template>
  <section>
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-base-content/70">Meine Einkaufsliste</h3>
    </div>

    <RouterLink
      to="/list"
      class="card card-side bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow"
    >
      <figure class="pl-4">
        <div class="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon icon="lucide:shopping-basket" width="32" height="32" class="text-primary" />
        </div>
      </figure>
      <div class="card-body p-4">
        <h4 class="card-title text-base">Wocheneinkauf</h4>
        <p class="text-sm text-base-content/70">
          {{ count > 0 ? countLabel : 'Noch keine Produkte' }}
        </p>
      </div>
      <div class="flex items-center pr-4">
        <Icon icon="lucide:chevron-right" width="20" height="20" class="text-base-content/50" />
      </div>
    </RouterLink>
  </section>
</template>
