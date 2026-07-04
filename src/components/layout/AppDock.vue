<script setup>
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'

/**
 * Bottom navigation dock (mobile-first).
 *
 * Provides three tabs: Startseite, Einkaufsliste and Profil. Stretches across
 * the full screen width, distributes its items evenly and hides the text
 * labels on very small screens. Each item is vertically centered.
 */
</script>

<template>
  <nav
    class="fixed bottom-0 left-0 right-0 w-full flex items-stretch justify-around bg-base-100 border-t border-base-300 z-50"
  >
    <RouterLink
      v-for="item in [
        { to: '/', icon: 'lucide:home', label: 'Startseite' },
        { to: '/list', icon: 'lucide:shopping-cart', label: 'Einkaufsliste' },
        { to: '/profile', icon: 'lucide:user', label: 'Profil' },
      ]"
      :key="item.to"
      :to="item.to"
      custom
      v-slot="{ isActive, navigate }"
    >
      <button
        :class="{ 'text-primary': isActive }"
        class="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-base-content"
        @click="navigate"
      >
        <Icon :icon="item.icon" width="24" height="24" />
        <span class="dock-label text-xs sm:inline hidden">{{ item.label }}</span>
      </button>
    </RouterLink>
  </nav>
</template>
