<script setup>
import { ref, computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { useMarketStore } from '@/stores/market'
import ProductSearch from '@/components/shopping/ProductSearch.vue'
import SupermarketModal from '@/components/shopping/SupermarketModal.vue'
import ListSummary from '@/components/shopping/ListSummary.vue'
import GroupedList from '@/components/shopping/GroupedList.vue'
import OptimizeButton from '@/components/shopping/OptimizeButton.vue'

/**
 * Einkaufsliste (Shopping List) view.
 *
 * The primary interactive workspace of the application. Contains the
 * supermarket pre-selection trigger, the smart search input, the grouped list
 * of items and the persistent optimization button.
 *
 * When the view is opened and no supermarkets have been selected yet (also
 * true on first visit after a page reload with an empty localStorage), the
 * supermarket pre-selection modal opens automatically.
 */
const marketStore = useMarketStore()

/** Whether the supermarket modal is open. */
const modalOpen = ref(false)

/** Number of selected supermarkets for the badge. */
const selectedCount = computed(() => marketStore.selectedMarkets.length)

// Auto-open the supermarket modal on first mount if the user has not yet
// selected any supermarkets. The selection is persisted via useLocalStorage,
// so returning users with a saved selection will not see the prompt.
onMounted(() => {
  if (!marketStore.hasSelection) {
    modalOpen.value = true
  }
})
</script>

<template>
  <section class="container mx-auto px-4 py-6 max-w-2xl flex flex-col gap-6 min-w-0">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Einkaufsliste</h1>
      <button class="btn btn-sm btn-outline gap-2" @click="modalOpen = true">
        <Icon icon="lucide:sliders-horizontal" width="16" height="16" />
        Supermärkte
        <span v-if="selectedCount > 0" class="badge badge-primary badge-sm">
          {{ selectedCount }}
        </span>
      </button>
    </header>

    <ProductSearch />

    <ListSummary />

    <GroupedList />

    <OptimizeButton />

    <SupermarketModal :open="modalOpen" @close="modalOpen = false" />
  </section>
</template>
