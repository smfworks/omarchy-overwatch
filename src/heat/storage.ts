import { HEAT_KEY } from './types'

export interface HeatPrefsV1 {
  version: 1
  enabled: boolean
}

export const DEFAULT_HEAT_PREFS: HeatPrefsV1 = { version: 1, enabled: false }

export function sanitizeHeatPrefs(raw: unknown): HeatPrefsV1 {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  if (row.version !== 1) return { ...DEFAULT_HEAT_PREFS }
  return { version: 1, enabled: row.enabled === true }
}

export function loadHeatPrefs(): HeatPrefsV1 {
  try {
    const raw = localStorage.getItem(HEAT_KEY)
    if (!raw) return { ...DEFAULT_HEAT_PREFS }
    return sanitizeHeatPrefs(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_HEAT_PREFS }
  }
}

export function saveHeatPrefs(prefs: HeatPrefsV1): void {
  localStorage.setItem(HEAT_KEY, JSON.stringify(sanitizeHeatPrefs(prefs)))
}
