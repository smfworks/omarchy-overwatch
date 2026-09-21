export const HUD_KEY = 'omarchy-overwatch.hud.v1'

export const HUD_DENSITIES = ['operator', 'minimal', 'presentation'] as const
export type HudDensity = (typeof HUD_DENSITIES)[number]

export const MAP_OVERLAYS = ['off', 'nvg', 'flir', 'crt'] as const
export type MapOverlay = (typeof MAP_OVERLAYS)[number]

export interface HudPrefsV1 {
  version: 1
  density: HudDensity
  overlay: MapOverlay
  legendOpen: boolean
}

export const DEFAULT_HUD_PREFS: HudPrefsV1 = {
  version: 1,
  density: 'operator',
  overlay: 'off',
  legendOpen: false,
}

export function isHudDensity(raw: unknown): raw is HudDensity {
  return raw === 'operator' || raw === 'minimal' || raw === 'presentation'
}

export function isMapOverlay(raw: unknown): raw is MapOverlay {
  return raw === 'off' || raw === 'nvg' || raw === 'flir' || raw === 'crt'
}

export function sanitizeHudPrefs(raw: unknown): HudPrefsV1 {
  const row = raw && typeof raw !== 'object' ? {} : ((raw as Record<string, unknown>) ?? {})
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : row
  if (obj.version !== 1) return { ...DEFAULT_HUD_PREFS }
  return {
    version: 1,
    density: isHudDensity(obj.density) ? obj.density : 'operator',
    overlay: isMapOverlay(obj.overlay) ? obj.overlay : 'off',
    legendOpen: obj.legendOpen === true,
  }
}

export function loadHudPrefs(): HudPrefsV1 {
  try {
    const raw = localStorage.getItem(HUD_KEY)
    if (!raw) return { ...DEFAULT_HUD_PREFS }
    return sanitizeHudPrefs(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_HUD_PREFS }
  }
}

export function saveHudPrefs(prefs: HudPrefsV1): void {
  localStorage.setItem(HUD_KEY, JSON.stringify(sanitizeHudPrefs(prefs)))
}

export function cycleDensity(current: HudDensity): HudDensity {
  const i = HUD_DENSITIES.indexOf(current)
  return HUD_DENSITIES[(i + 1) % HUD_DENSITIES.length]
}

/** Presentation hides all docks; minimal keeps the status strip. */
export function docksForDensity(
  density: HudDensity,
  layout: { left: boolean; right: boolean; top: boolean; bottom: boolean },
): { left: boolean; right: boolean; top: boolean; bottom: boolean } {
  if (density === 'operator') return layout
  if (density === 'minimal') return { left: false, right: false, top: true, bottom: false }
  return { left: false, right: false, top: false, bottom: false }
}
