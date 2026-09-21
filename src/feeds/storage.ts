export const FEEDS_KEY = 'omarchy-overwatch.feeds.v1'
export const CUSTOM_FEEDS_MAX = 12
export const FEED_URL_MAX = 500
export const FEED_LABEL_MAX = 48

export const BUILTIN_FEED_IDS = ['bbc', 'reliefweb', 'gdacs'] as const
export type BuiltinFeedId = (typeof BUILTIN_FEED_IDS)[number]

export interface CustomFeed {
  id: string
  label: string
  url: string
  enabled: boolean
}

export interface FeedPrefsV1 {
  version: 1
  builtinEnabled: Record<BuiltinFeedId, boolean>
  custom: CustomFeed[]
}

export const DEFAULT_FEED_PREFS: FeedPrefsV1 = {
  version: 1,
  builtinEnabled: { bbc: true, reliefweb: true, gdacs: true },
  custom: [],
}

export function isAllowedFeedUrl(raw: string): boolean {
  const t = raw.trim()
  if (!t || t.length > FEED_URL_MAX) return false
  let parsed: URL
  try {
    parsed = new URL(t)
  } catch {
    return false
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (!parsed.hostname) return false
  return true
}

export function normalizeFeedUrl(raw: string): string | null {
  const t = raw.trim()
  if (!isAllowedFeedUrl(t)) return null
  return new URL(t).href
}

export function labelFromFeedUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').slice(0, FEED_LABEL_MAX)
  } catch {
    return 'custom'
  }
}

function asId(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 80)
  return fallback
}

function sanitizeCustom(raw: unknown, index: number): CustomFeed | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const url = typeof row.url === 'string' ? normalizeFeedUrl(row.url) : null
  if (!url) return null
  const labelRaw = typeof row.label === 'string' ? row.label.replace(/\s+/g, ' ').trim() : ''
  return {
    id: asId(row.id, `custom-${index}`),
    label: (labelRaw || labelFromFeedUrl(url)).slice(0, FEED_LABEL_MAX),
    url,
    enabled: row.enabled !== false,
  }
}

export function sanitizeFeedPrefs(partial: unknown): FeedPrefsV1 {
  const row = partial && typeof partial === 'object' ? (partial as Record<string, unknown>) : {}
  const enabledRaw =
    row.builtinEnabled && typeof row.builtinEnabled === 'object'
      ? (row.builtinEnabled as Record<string, unknown>)
      : {}
  const customRaw = Array.isArray(row.custom) ? row.custom : []
  const seen = new Set<string>()
  const custom: CustomFeed[] = []
  for (const [i, item] of customRaw.entries()) {
    const feed = sanitizeCustom(item, i)
    if (!feed) continue
    if (seen.has(feed.url)) continue
    seen.add(feed.url)
    custom.push(feed)
    if (custom.length >= CUSTOM_FEEDS_MAX) break
  }
  return {
    version: 1,
    builtinEnabled: {
      bbc: enabledRaw.bbc !== false,
      reliefweb: enabledRaw.reliefweb !== false,
      gdacs: enabledRaw.gdacs !== false,
    },
    custom,
  }
}

export function loadFeedPrefs(): FeedPrefsV1 {
  try {
    const raw = localStorage.getItem(FEEDS_KEY)
    if (!raw) return { ...DEFAULT_FEED_PREFS, builtinEnabled: { ...DEFAULT_FEED_PREFS.builtinEnabled } }
    return sanitizeFeedPrefs(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_FEED_PREFS, builtinEnabled: { ...DEFAULT_FEED_PREFS.builtinEnabled } }
  }
}

export function saveFeedPrefs(prefs: FeedPrefsV1): void {
  localStorage.setItem(FEEDS_KEY, JSON.stringify(sanitizeFeedPrefs(prefs)))
}

export function addCustomFeed(prefs: FeedPrefsV1, urlRaw: string, labelRaw?: string): FeedPrefsV1 | { error: string } {
  const url = normalizeFeedUrl(urlRaw)
  if (!url) return { error: 'URL must be http or https' }
  if (prefs.custom.some((f) => f.url === url)) return { error: 'Feed already added' }
  if (prefs.custom.length >= CUSTOM_FEEDS_MAX) return { error: `At most ${CUSTOM_FEEDS_MAX} custom feeds` }
  const label = (labelRaw ?? '').replace(/\s+/g, ' ').trim().slice(0, FEED_LABEL_MAX) || labelFromFeedUrl(url)
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `custom-${crypto.randomUUID()}`
      : `custom-${Date.now()}`
  return sanitizeFeedPrefs({
    ...prefs,
    custom: [...prefs.custom, { id, label, url, enabled: true }],
  })
}

export function toggleBuiltin(prefs: FeedPrefsV1, id: BuiltinFeedId): FeedPrefsV1 {
  return {
    ...prefs,
    builtinEnabled: { ...prefs.builtinEnabled, [id]: !prefs.builtinEnabled[id] },
  }
}

export function toggleCustom(prefs: FeedPrefsV1, id: string): FeedPrefsV1 {
  return {
    ...prefs,
    custom: prefs.custom.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)),
  }
}

export function removeCustom(prefs: FeedPrefsV1, id: string): FeedPrefsV1 {
  return { ...prefs, custom: prefs.custom.filter((f) => f.id !== id) }
}
