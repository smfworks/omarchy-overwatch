import { isMapStyleId, type MapStyleId } from './styles'

export const MAP_STYLE_KEY = 'omarchy-overwatch.mapstyle.v1'

export interface MapStylePrefsV1 {
  version: 1
  style: MapStyleId
  /** Aesthetic NVG tint only — not a sensor, not a claim of night-vision data. */
  nvg: boolean
}

export const DEFAULT_MAP_STYLE_PREFS: MapStylePrefsV1 = { version: 1, style: 'default', nvg: false }

export function sanitizeMapStylePrefs(raw: unknown): MapStylePrefsV1 {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  if (row.version !== 1) return { ...DEFAULT_MAP_STYLE_PREFS }
  return {
    version: 1,
    style: isMapStyleId(row.style) ? row.style : 'default',
    nvg: row.nvg === true,
  }
}

export function loadMapStylePrefs(): MapStylePrefsV1 {
  try {
    const raw = localStorage.getItem(MAP_STYLE_KEY)
    if (!raw) return { ...DEFAULT_MAP_STYLE_PREFS }
    return sanitizeMapStylePrefs(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_MAP_STYLE_PREFS }
  }
}

export function saveMapStylePrefs(prefs: MapStylePrefsV1): void {
  localStorage.setItem(MAP_STYLE_KEY, JSON.stringify(sanitizeMapStylePrefs(prefs)))
}
