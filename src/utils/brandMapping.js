/**
 * @file Brand mapping helpers for the Overpass API integration.
 * @description The Overpass API returns supermarket nodes with a `brand` tag
 * containing the brand name as written in OpenStreetMap (e.g. "Aldi", "REWE
 * City"). These helpers translate those raw brand strings into the internal
 * supermarket ids used throughout the app (see `SUPPORTED_SUPERMARKETS`).
 */

/**
 * Mapping of raw Overpass `brand` tag values (lower-cased) to the internal
 * supermarket id. The keys are matched case-insensitively against the brand
 * tag returned by Overpass.
 *
 * @type {Record<string, string>}
 */
const BRAND_TO_ID = {
  aldi: 'aldi-sued',
  'aldi süd': 'aldi-sued',
  'aldi sued': 'aldi-sued',
  'aldi nord': 'aldi-sued',
  rewe: 'rewe',
  'rewe city': 'rewe',
  'rewe to-go': 'rewe',
  lidl: 'lidl',
  netto: 'netto-marken-discount',
  'netto-marken-discount': 'netto-marken-discount',
  'netto marken-discount': 'netto-marken-discount',
}

/**
 * Build a case-insensitive Overpass QL regex fragment from the supported
 * brand names. The result can be injected into a `["brand"~"...",i]` filter.
 *
 * @returns {string} Pipe-separated brand regex (e.g. `Aldi|REWE|Lidl|Netto`).
 */
export function brandRegex() {
  // Use the canonical brand names we want to match in Overpass. We keep the
  // list intentionally small to avoid hitting Overpass rate limits.
  return ['Aldi', 'REWE', 'Lidl', 'Netto'].join('|')
}

/**
 * Resolve a raw Overpass `brand` tag value to the internal supermarket id.
 * Returns `null` when the brand is not recognised so the caller can decide
 * whether to keep or discard the node.
 *
 * @param {string} brand - Raw brand tag from the Overpass response.
 * @returns {string|null} Internal supermarket id or `null`.
 */
export function brandToSupermarketId(brand) {
  if (!brand) return null
  const normalized = brand.trim().toLowerCase()
  return BRAND_TO_ID[normalized] ?? null
}
