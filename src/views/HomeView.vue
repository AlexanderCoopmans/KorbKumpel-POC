<script setup>
import HeroSection from '@/components/home/HeroSection.vue'
import ListPreviewCard from '@/components/home/ListPreviewCard.vue'
import HorizontalSection from '@/components/home/HorizontalSection.vue'
import OfferCard from '@/components/home/OfferCard.vue'
import MarketChip from '@/components/home/MarketChip.vue'
import { SUPPORTED_SUPERMARKETS } from '@/utils/supermarkets'

/**
 * Startseite (Home) view.
 *
 * Mobile-first dashboard inspired by modern offer apps. Contains a greeting
 * hero, a preview of the current shopping list, personalized top offers and
 * the user's favorite supermarkets.
 */

/**
 * Sample top offers shown on the home screen.
 * In a production app these would be fetched from the Typesense collection.
 * @type {import('@/components/home/OfferCard.vue').Offer[]}
 */
const topOffers = [
  {
    name: 'Fleischtomaten',
    brand: 'Netto Marken-Discount',
    image: 'https://cdn.marktguru.de/api/v1/offers/23788244/images/default/0/medium.webp',
    price: '2,49 €',
    unit: '1 KG',
  },
  {
    name: 'Pfirsiche',
    brand: 'Lidl',
    image: 'https://cdn.marktguru.de/api/v1/offers/23897480/images/default/0/medium.webp',
    price: '1,69 €',
    unit: '1 KG',
  },
  {
    name: 'Mini-Gurken',
    brand: 'REWE',
    image: 'https://cdn.marktguru.de/api/v1/offers/23797817/images/default/0/medium.webp',
    price: '0,45 €',
    unit: '1 KG',
  },
  {
    name: 'Plattpfirsiche',
    brand: 'Lidl',
    image: 'https://cdn.marktguru.de/api/v1/offers/23885357/images/default/0/medium.webp',
    price: '1,79 €',
    unit: '1 KG',
  },
  {
    name: 'Fairtrade Passionsfrucht',
    brand: 'Lidl',
    image: 'https://cdn.marktguru.de/api/v1/offers/23885429/images/default/0/medium.webp',
    price: '2,69 €',
    unit: '1 KG',
  },
  {
    name: 'Mini-Romana-Salat',
    brand: 'Lidl',
    image: 'https://cdn.marktguru.de/api/v1/offers/23884190/images/default/0/medium.webp',
    price: '0,65 €',
    unit: '1 KG',
  },
  {
    name: 'Cantaloupemelone',
    brand: 'Lidl',
    image: 'https://cdn.marktguru.de/api/v1/offers/23884202/images/default/0/medium.webp',
    price: '1,69 €',
    unit: '1 KG',
  },
  {
    name: 'Mango',
    brand: 'Lidl',
    image: 'https://cdn.marktguru.de/api/v1/offers/23884214/images/default/0/medium.webp',
    price: '1,19 €',
    unit: '1 KG',
  },
  {
    name: 'Kokoschips',
    brand: 'REWE',
    image: 'https://cdn.marktguru.de/api/v1/offers/23775038/images/default/0/medium.webp',
    price: '2,49 €',
    unit: '1 KG',
  },
  {
    name: 'Blumenkohl',
    brand: 'Netto Marken-Discount',
    image: 'https://cdn.marktguru.de/api/v1/offers/23787341/images/default/0/medium.webp',
    price: '1,29 €',
    unit: '1 KG',
  },
  {
    name: 'Bio-Möhren',
    brand: 'Netto Marken-Discount',
    image: 'https://cdn.marktguru.de/api/v1/offers/23787353/images/default/0/medium.webp',
    price: '1,99 €',
    unit: '1 KG',
  },
  {
    name: 'Bio Knoblauch',
    brand: 'Netto Marken-Discount',
    image: 'https://cdn.marktguru.de/api/v1/offers/23787401/images/default/0/medium.webp',
    price: '1,29 €',
    unit: '1 KG',
  },
]

/**
 * Sample favorite supermarkets.
 * @type {import('@/components/home/MarketChip.vue').Market[]}
 */
const favoriteMarkets = SUPPORTED_SUPERMARKETS.map((market) => ({
  id: market.id,
  label: market.label,
  image: market.logo,
}))
</script>

<template>
  <div class="flex flex-col gap-6 px-4 py-5 max-w-2xl mx-auto">
    <HeroSection />

    <ListPreviewCard />

    <HorizontalSection title="Obst & Gemüse Angebote" more-label="Mehr Angebote" more-href="#">
      <OfferCard v-for="offer in topOffers" :key="offer.name" :offer="offer" />
    </HorizontalSection>

    <HorizontalSection title="Deine Lieblingsmärkte" more-label="Alle anzeigen" more-href="#">
      <MarketChip v-for="market in favoriteMarkets" :key="market.id" :market="market" />
    </HorizontalSection>
  </div>
</template>
