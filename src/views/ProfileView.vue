<script setup>
import { Icon } from '@iconify/vue'

/**
 * Profil (Profile) view.
 *
 * Generic placeholder section for user settings or profile details.
 */
</script>

<template>
  <section class="container mx-auto px-4 py-6 max-w-2xl space-y-6">
    <h1 class="text-2xl font-bold">Profil</h1>
    <div class="card bg-base-100 shadow">
      <div class="card-body items-center text-center gap-3 py-10">
        <div class="rounded-full bg-primary/10 p-5">
          <Icon icon="lucide:user" width="40" height="40" class="text-primary" />
        </div>
        <p class="text-base-content/70 max-w-sm">
          Hier werden bald persönliche Einstellungen und Profildetails erscheinen.
        </p>
      </div>
    </div>
  </section>
</template>
