<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Interactive Leaflet map used inside the supermarket modal.
 *
 * Renders the user's location as a marker, supermarket markers for every
 * discovered store and a polyline for the currently selected route option.
 *
 * @prop {Object|null} origin - `{ lat, lng }` of the user or `null`.
 * @prop {Array} supermarkets - Discovered supermarkets (see composable).
 * @prop {Object|null} selectedRoute - Currently highlighted route option.
 */

const props = defineProps({
  origin: { type: Object, default: null },
  supermarkets: { type: Array, default: () => [] },
  selectedRoute: { type: Object, default: null },
})

/** @type {import('vue').Ref<HTMLElement|null>} */
const mapEl = ref(null)
/** @type {L.Map|null} */
let map = null
/** @type {L.LayerGroup|null} */
let markerLayer = null
/** @type {L.Polyline|null} */
let routeLine = null

/**
 * Initialize the Leaflet map instance once the container element is mounted.
 * @returns {Promise<void>}
 */
async function initMap() {
  await nextTick()
  if (!mapEl.value || map) return

  map = L.map(mapEl.value, { zoomControl: true, attributionControl: true })
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  }).addTo(map)
  markerLayer = L.layerGroup().addTo(map)
  map.setView([51.1657, 10.4515], 6) // Default: Germany center
  redraw()
}

/**
 * Remove the Leaflet map instance and free its DOM listeners.
 */
function destroyMap() {
  if (map) {
    map.remove()
    map = null
    markerLayer = null
    routeLine = null
  }
}

/**
 * Redraw all markers and the selected route polyline based on the current
 * props. Called whenever the inputs change.
 */
function redraw() {
  if (!map || !markerLayer) return
  markerLayer.clearLayers()
  if (routeLine) {
    routeLine.remove()
    routeLine = null
  }

  const bounds = []

  // User location marker.
  if (props.origin) {
    const m = L.marker([props.origin.lat, props.origin.lng], {
      icon: userIcon(),
    }).addTo(markerLayer)
    m.bindPopup('Dein Standort')
    bounds.push([props.origin.lat, props.origin.lng])
  }

  // Supermarket markers.
  for (const store of props.supermarkets) {
    const m = L.marker([store.lat, store.lon], {
      icon: storeIcon(),
    }).addTo(markerLayer)
    m.bindPopup(`${store.label}${store.name ? ` – ${store.name}` : ''}`)
    bounds.push([store.lat, store.lon])
  }

  // Selected route polyline.
  if (props.selectedRoute?.coords?.length) {
    routeLine = L.polyline(props.selectedRoute.coords, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.8,
    }).addTo(markerLayer)
    for (const [lat, lon] of props.selectedRoute.coords) {
      bounds.push([lat, lon])
    }
  }

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }
}

/**
 * Build a blue circle marker for the user's location.
 * @returns {L.DivIcon}
 */
function userIcon() {
  return L.divIcon({
    className: 'kk-user-marker',
    html: '<div style="width:18px;height:18px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.4)"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

/**
 * Build a red pin marker for supermarkets.
 * @returns {L.DivIcon}
 */
function storeIcon() {
  return L.divIcon({
    className: 'kk-store-marker',
    html: '<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

// Initialize the map when the container becomes available.
watch(mapEl, async (el) => {
  if (el) await initMap()
})

// Redraw whenever any of the inputs change.
watch(() => [props.origin, props.supermarkets, props.selectedRoute], redraw, { deep: true })

onBeforeUnmount(destroyMap)
</script>

<template>
  <div ref="mapEl" class="h-64 w-full rounded-box overflow-hidden border border-base-300" />
</template>
