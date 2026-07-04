<script setup>
import { RouterLink } from 'vue-router'
import { Icon } from '@iconify/vue'
import logoWithName from '@/assets/logo-and-name.png'

/**
 * Startseite (Home) view.
 *
 * Placeholder section reserved for future promotional offers. Contains a
 * prominent call-to-action that routes the user to the shopping list view.
 */
</script>

<template>
  <section class="hero bg-base-100 min-h-[70vh]">
    <div class="hero-content text-center">
      <div class="max-w-md flex flex-col items-center gap-6">
        <img :src="logoWithName" alt="KorbKumpel Logo" class="w-64 h-auto" />
        <div class="space-y-4">
          <h1 class="text-4xl font-bold">Willkommen bei KorbKumpel</h1>
          <p class="text-base-content/70">
            Hier entstehen bald spannende Angebote. Starte jetzt mit deiner Einkaufsliste und spare
            beim Einkaufen.
          </p>
        </div>
        <RouterLink to="/list" class="btn btn-primary btn-lg gap-2">
          <Icon icon="lucide:plus" width="20" height="20" />
          Einkaufsliste erstellen
        </RouterLink>
      </div>
    </div>
  </section>
</template>
