<script setup>
import { RouterView } from 'vue-router'
import AppDock from '@/components/layout/AppDock.vue'
</script>

<template>
  <div class="min-h-screen bg-base-200 flex flex-col">
    <main class="flex-1 pb-24">
      <RouterView />
    </main>
    <AppDock />
  </div>
</template>
