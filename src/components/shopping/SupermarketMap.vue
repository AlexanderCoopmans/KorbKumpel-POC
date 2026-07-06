<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'

// Supermarket logos imported via Vite so the bundler resolves the paths.
import aldiLogo from '@/assets/supermarket-logos/aldi.jpg'
import reweLogo from '@/assets/supermarket-logos/Rewe_Logo.png'
import lidlLogo from '@/assets/supermarket-logos/Lidl-Logo.webp'
import nettoLogo from '@/assets/supermarket-logos/Netto_logo.svg'

/**
 * Map of internal supermarket id -> resolved logo URL.
 * Used to pick the correct icon for each store marker.
 * @type {Record<string, string>}
 */
const SUPERMARKET_LOGOS = {
  'aldi-sued': aldiLogo,
  rewe: reweLogo,
  lidl: lidlLogo,
  'netto-marken-discount': nettoLogo,
}

/**
 * Interactive Leaflet map used inside the supermarket modal.
 *
 * Renders the user's location as a marker, supermarket markers for every
 * discovered store and — when a route is selected — the actual driving
 * path between origin -> supermarkets -> origin using the
 * Leaflet Routing Machine (OSRM demo server under the hood).
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
/**
 * Leaflet map instance. Kept as a plain variable (not a `ref`) because
 * Leaflet objects are huge and deeply nested — wrapping them in a Vue ref
 * would make Vue try to track every property, which kills performance and
 * can cause rendering bugs.
 * @type {L.Map|null}
 */
let map = null
/** @type {L.LayerGroup|null} Layer group holding all custom markers. */
let markerLayer = null
/** @type {L.Routing.Control|null} Routing machine control for the selected route. */
let routingControl = null

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
  removeRoutingControl()
  if (map) {
    map.remove()
    map = null
    markerLayer = null
  }
}

/**
 * Remove the current routing control from the map (if any).
 */
function removeRoutingControl() {
  if (routingControl && map) {
    map.removeControl(routingControl)
  }
  routingControl = null
}

/**
 * Build the ordered list of Leaflet waypoints for the currently selected
 * route: origin -> supermarket stops -> origin (round trip).
 *
 * Returns an empty array when no route is selected or the origin is missing.
 *
 * @returns {L.Routing.Waypoint[]}
 */
function buildWaypoints() {
  if (!props.origin || !props.selectedRoute?.stops?.length) return []
  const stops = props.selectedRoute.stops
  /** @type {L.LatLng[]} */
  const points = [
    L.latLng(props.origin.lat, props.origin.lng),
    ...stops.map((s) => L.latLng(s.lat, s.lon)),
    L.latLng(props.origin.lat, props.origin.lng),
  ]
  return points.map((p, idx) => {
    // Suppress the default routing markers — we draw our own custom
    // markers in `redraw()` to keep the visual style consistent.
    return new L.Routing.Waypoint(p, undefined, {
      allowUTurn: true,
      // The first and last waypoints are the user's location.
      name: idx === 0 || idx === points.length - 1 ? 'Dein Standort' : undefined,
    })
  })
}

/**
 * (Re)create the Leaflet Routing Machine control for the selected route.
 * The control queries the OSRM demo server for the actual road path and
 * draws it on the map. The itinerary panel is hidden to keep the modal
 * compact; only the route line is shown.
 */
function updateRoute() {
  if (!map) return
  removeRoutingControl()

  const waypoints = buildWaypoints()
  if (waypoints.length === 0) return

  routingControl = L.Routing.control({
    waypoints,
    routeWhileDragging: false,
    show: false, // Hide the itinerary panel (we only want the line).
    addWaypoints: false, // Disable click-to-add-waypoint interaction.
    draggableWaypoints: false, // Lock waypoints (read-only display).
    fitSelectedRoutes: true, // Auto-zoom to the computed route.
    lineOptions: {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.85,
      addWaypoints: false,
    },
    // Suppress the default waypoint markers — we render our own.
    createMarker: () => null,
    // Use the OSRM demo backend (same as the distance matrix in the
    // composable). The default service also points here, but we set it
    // explicitly for clarity.
    router: L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1',
      language: 'de',
    }),
  })
  routingControl.addTo(map)
}

/**
 * Redraw all custom markers based on the current props. The driving route
 * itself is handled separately by `updateRoute()` via the routing machine.
 */
function redraw() {
  if (!map || !markerLayer) return
  markerLayer.clearLayers()

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
      icon: storeIcon(store.supermarketId),
    }).addTo(markerLayer)
    m.bindPopup(`${store.label}${store.name ? ` – ${store.name}` : ''}`)
    bounds.push([store.lat, store.lon])
  }

  // Fit the view to the markers when no route is active (the routing
  // machine handles fitting when a route is selected).
  if (bounds.length && !props.selectedRoute) {
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
 * Size (in px) for the supermarket logo markers.
 * @type {number}
 */
const STORE_ICON_SIZE = 32

/**
 * Build a logo marker for a supermarket. The marker is a circular badge
 * containing the chain's logo, so it is immediately clear on the map which
 * supermarket is located where. Falls back to a generic red pin when the
 * supermarket id is unknown.
 *
 * @param {string} [supermarketId] - Internal supermarket id.
 * @returns {L.DivIcon}
 */
function storeIcon(supermarketId) {
  const logoUrl = supermarketId ? SUPERMARKET_LOGOS[supermarketId] : null
  if (!logoUrl) {
    return L.divIcon({
      className: 'kk-store-marker',
      html: '<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    })
  }
  const size = STORE_ICON_SIZE
  const half = size / 2
  return L.divIcon({
    className: 'kk-store-marker',
    html:
      `<div style="width:${size}px;height:${size}px;border-radius:50%;` +
      `background:#fff;border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.45);` +
      `overflow:hidden;display:flex;align-items:center;justify-content:center">` +
      `<img src="${logoUrl}" alt="" style="width:100%;height:100%;object-fit:contain"/>` +
      `</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half],
  })
}

// Initialize the map when the container becomes available.
watch(mapEl, async (el) => {
  if (el) await initMap()
})

// Redraw markers when origin or supermarkets change.
watch(() => [props.origin, props.supermarkets], redraw, { deep: true })

// Recompute the driving route when the selected route changes.
watch(() => props.selectedRoute, updateRoute, { deep: true })

onBeforeUnmount(destroyMap)
</script>

<template>
  <div ref="mapEl" class="h-64 w-full rounded-box overflow-hidden border border-base-300" />
</template>
