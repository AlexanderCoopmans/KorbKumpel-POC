<script setup>
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'

/**
 * Hero section for the home view.
 *
 * Displays a personalized greeting and a prominent call-to-action that
 * routes the user to the shopping list view.
 */
</script>

<template>
  <section class="bg-primary text-primary-content rounded-2xl p-6 shadow-lg">
    <div class="flex flex-row items-center justify-between">
      <div>
        <h2 class="mt-2 text-2xl font-bold leading-tight">
          Bereit für deinen<br />nächsten Einkauf?
        </h2>
        <RouterLink
          to="/list"
          class="btn btn-primary-content text-primary mt-5 gap-2 rounded-full px-6 shadow"
        >
          <Icon icon="lucide:plus" width="18" height="18" />
          Neue Einkaufsliste
        </RouterLink>
      </div>
      <img
        src="@/assets/logo.svg"
        alt="KorbKumpel Logo"
        class="w-32"
        style="filter: brightness(0) invert(1)"
      />
    </div>
  </section>
</template>
