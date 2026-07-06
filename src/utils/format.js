/**
 * @file Price formatting helpers.
 * @description Typesense stores prices as integer cents (`retailPrice`,
 * `basePrice`). These helpers convert them to a German formatted string.
 */

/**
 * Format an integer cent value into a German currency string.
 *
 * @param {number} cents - Price in cents (e.g. 219 => "2,19 €").
 * @returns {string} Formatted price using German locale and Euro currency.
 */
export function formatPrice(cents) {
  if (cents == null || Number.isNaN(Number(cents))) return '—'
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number(cents) / 100)
}

/**
 * Format the base price together with its base unit.
 * Example: basePrice 324, baseUnit "1 Liter" => "3,24 € / 1 Liter"
 *
 * @param {number} basePrice - Base price in cents.
 * @param {string} baseUnit - Unit description from Typesense.
 * @returns {string} Combined base price string.
 */
export function formatBasePrice(basePrice, baseUnit) {
  if (basePrice == null) return '—'
  const price = formatPrice(basePrice)
  return baseUnit ? `${price} / ${baseUnit}` : price
}

/**
 * Format a duration in seconds as a compact German string.
 * Examples: 45 => "45 s", 90 => "1 min 30 s", 3700 => "1 h 1 min".
 *
 * @param {number} seconds - Duration in seconds.
 * @returns {string} Human readable duration.
 */
export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—'
  const s = Math.max(0, Math.round(Number(seconds)))
  if (s < 60) return `${s} s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const rest = s % 60
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`
  if (m > 0 && rest > 0) return `${m} min ${rest} s`
  return `${m} min`
}

/**
 * Format a distance in meters as a compact German string.
 * Examples: 350 => "350 m", 1200 => "1,2 km".
 *
 * @param {number} meters - Distance in meters.
 * @returns {string} Human readable distance.
 */
export function formatDistance(meters) {
  if (meters == null || Number.isNaN(Number(meters))) return '—'
  const m = Math.max(0, Number(meters))
  if (m >= 1000) return `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`
  return `${Math.round(m)} m`
}
