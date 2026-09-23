/** Single-key layer toggles. Must not collide with /, ?, b, n, d, k, g, 1–4, [, ]. */
export const LAYER_SHORTCUTS = [
  { key: 'q', layerId: 'earthquakes', label: 'USGS' },
  { key: 'e', layerId: 'eonet', label: 'EONET' },
  { key: 'a', layerId: 'opensky', label: 'ADS-B' },
  { key: 'f', layerId: 'firms', label: 'FIRMS' },
] as const

const RESERVED = new Set(['/', '?', 'b', 'n', 'd', 'k', 'g', '1', '2', '3', '4', '[', ']'])

export function layerIdForShortcut(key: string): string | null {
  const lower = key.toLowerCase()
  if (RESERVED.has(lower)) return null
  const hit = LAYER_SHORTCUTS.find((row) => row.key === lower)
  return hit?.layerId ?? null
}

export function shortcutForLayer(layerId: string): string | null {
  return LAYER_SHORTCUTS.find((row) => row.layerId === layerId)?.key ?? null
}
