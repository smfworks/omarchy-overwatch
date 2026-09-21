export const FAVORITES_KEY = 'omarchy-overwatch.favorites.v1'
export const FAVORITES_MAX = 24
export const RECENTS_MAX = 16

export interface FavoritesV1 {
  version: 1
  pinned: string[]
  recent: { id: string; at: number }[]
}

export const DEFAULT_FAVORITES: FavoritesV1 = { version: 1, pinned: [], recent: [] }

function asToolId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(t)) return null
  return t
}

export function sanitizeFavorites(raw: unknown): FavoritesV1 {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FAVORITES, pinned: [], recent: [] }
  const row = raw as Record<string, unknown>
  if (row.version !== 1) return { ...DEFAULT_FAVORITES, pinned: [], recent: [] }
  const pinned: string[] = []
  const seen = new Set<string>()
  if (Array.isArray(row.pinned)) {
    for (const item of row.pinned) {
      const id = asToolId(item)
      if (!id || seen.has(id)) continue
      seen.add(id)
      pinned.push(id)
      if (pinned.length >= FAVORITES_MAX) break
    }
  }
  const recent: { id: string; at: number }[] = []
  const recentSeen = new Set<string>()
  if (Array.isArray(row.recent)) {
    for (const item of row.recent) {
      if (!item || typeof item !== 'object') continue
      const rec = item as Record<string, unknown>
      const id = asToolId(rec.id)
      const at = typeof rec.at === 'number' && Number.isFinite(rec.at) ? rec.at : 0
      if (!id || recentSeen.has(id)) continue
      recentSeen.add(id)
      recent.push({ id, at })
      if (recent.length >= RECENTS_MAX) break
    }
  }
  return { version: 1, pinned, recent }
}

export function loadFavorites(): FavoritesV1 {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return { version: 1, pinned: [], recent: [] }
    return sanitizeFavorites(JSON.parse(raw) as unknown)
  } catch {
    return { version: 1, pinned: [], recent: [] }
  }
}

export function saveFavorites(prefs: FavoritesV1): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(sanitizeFavorites(prefs)))
}

export function togglePinned(prefs: FavoritesV1, id: string): FavoritesV1 {
  const toolId = asToolId(id)
  if (!toolId) return prefs
  const has = prefs.pinned.includes(toolId)
  const pinned = has ? prefs.pinned.filter((x) => x !== toolId) : [...prefs.pinned, toolId].slice(0, FAVORITES_MAX)
  return { version: 1, pinned, recent: prefs.recent }
}

export function recordRecent(prefs: FavoritesV1, id: string, at = Date.now()): FavoritesV1 {
  const toolId = asToolId(id)
  if (!toolId) return prefs
  const recent = [{ id: toolId, at }, ...prefs.recent.filter((r) => r.id !== toolId)].slice(0, RECENTS_MAX)
  return { version: 1, pinned: prefs.pinned, recent }
}

export function isPinned(prefs: FavoritesV1, id: string): boolean {
  return prefs.pinned.includes(id)
}
