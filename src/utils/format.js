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
