/**
 * @file Constants for supported supermarkets and display helpers.
 * @description Central list of supermarket identifiers used across the app.
 * If the Typesense collection returns a `supermarket` value that is not listed
 * here, it will still be displayed using its raw value as label.
 */

/**
 * Default list of supported supermarkets.
 * The `id` matches the `supermarket` field value stored in Typesense.
 * @type {{id: string, label: string}[]}
 */
export const SUPPORTED_SUPERMARKETS = [
  { id: 'aldi-sued', label: 'Aldi Süd' },
  { id: 'rewe', label: 'REWE' },
  { id: 'lidl', label: 'LIDL' },
  { id: 'netto-marken-discount', label: 'Netto' },
]

/**
 * Map a raw supermarket id (as stored in Typesense) to a human friendly label.
 * Falls back to the raw id when the supermarket is unknown.
 *
 * @param {string} id - The supermarket identifier.
 * @returns {string} A readable label for the supermarket.
 */
export function supermarketLabel(id) {
  const match = SUPPORTED_SUPERMARKETS.find((s) => s.id === id)
  return match ? match.label : id
}
