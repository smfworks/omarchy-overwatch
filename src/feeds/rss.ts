import {
  type BuiltinFeedId,
  type FeedPrefsV1,
  isAllowedFeedUrl,
  loadFeedPrefs,
} from './storage'

export interface TickerItem {
  id: string
  source: string
  title: string
  url: string
  published: string | null
  feedId: string
}

export type FeedStatus = 'loading' | 'live' | 'err' | 'empty' | 'stale' | 'off'

export interface FeedRuntime {
  id: string
  label: string
  builtin: boolean
  enabled: boolean
  status: FeedStatus
  error: string | null
  updatedAt: number | null
  itemCount: number
}

const STALE_MS = 15 * 60 * 1000

export const FEED_SOURCES: {
  id: BuiltinFeedId
  label: string
  url: string
}[] = [
  { id: 'bbc', label: 'BBC World', url: '/proxy/bbc/news/world/rss.xml' },
  { id: 'reliefweb', label: 'ReliefWeb', url: '/proxy/reliefweb/updates/rss.xml' },
  { id: 'gdacs', label: 'GDACS', url: '/proxy/gdacs/xml/rss.xml' },
]

function textOf(el: Element | null): string {
  return el?.textContent?.trim() || ''
}

function atomLink(entry: Element): string {
  const links = [...entry.querySelectorAll('link')]
  const alt = links.find((l) => {
    const rel = l.getAttribute('rel')
    return !rel || rel === 'alternate'
  })
  return (alt ?? links[0])?.getAttribute('href')?.trim() || textOf(links[0] ?? null)
}

export function parseFeedXml(xml: string, source: string, feedId: string): TickerItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('RSS parse error')
  const rssItems = [...doc.querySelectorAll('item')].slice(0, 12)
  if (rssItems.length) {
    return rssItems.map((item, i) => {
      const title = textOf(item.querySelector('title')) || 'Untitled'
      const link = textOf(item.querySelector('link')) || atomLink(item)
      const pub = textOf(item.querySelector('pubDate')) || textOf(item.querySelector('updated')) || null
      return {
        id: `${feedId}-${i}-${title.slice(0, 24)}`,
        source,
        title,
        url: link,
        published: pub,
        feedId,
      }
    })
  }
  const entries = [...doc.querySelectorAll('entry')].slice(0, 12)
  return entries.map((entry, i) => {
    const title = textOf(entry.querySelector('title')) || 'Untitled'
    const link = atomLink(entry)
    const pub =
      textOf(entry.querySelector('updated')) || textOf(entry.querySelector('published')) || null
    return {
      id: `${feedId}-${i}-${title.slice(0, 24)}`,
      source,
      title,
      url: link,
      published: pub,
      feedId,
    }
  })
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 12000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

function proxyCustom(url: string): string {
  return `/proxy/rss?url=${encodeURIComponent(url)}`
}

export function classifyFeedStatus(args: {
  enabled: boolean
  error: string | null
  updatedAt: number | null
  itemCount: number
}): FeedStatus {
  if (!args.enabled) return 'off'
  if (args.error && !args.updatedAt) return 'err'
  if (args.error && args.updatedAt) return 'stale'
  if (args.updatedAt && Date.now() - args.updatedAt > STALE_MS) return 'stale'
  if (args.updatedAt && args.itemCount === 0) return 'empty'
  if (args.updatedAt) return 'live'
  return 'loading'
}

export async function fetchTicker(
  prefs: FeedPrefsV1 = loadFeedPrefs(),
): Promise<{ items: TickerItem[]; feeds: FeedRuntime[]; errors: string[] }> {
  const jobs: { id: string; label: string; builtin: boolean; enabled: boolean; url: string }[] = [
    ...FEED_SOURCES.map((src) => ({
      id: src.id,
      label: src.label,
      builtin: true,
      enabled: prefs.builtinEnabled[src.id],
      url: src.url,
    })),
    ...prefs.custom.map((src) => ({
      id: src.id,
      label: src.label,
      builtin: false,
      enabled: src.enabled && isAllowedFeedUrl(src.url),
      url: proxyCustom(src.url),
    })),
  ]

  const errors: string[] = []
  const now = Date.now()
  const feeds: FeedRuntime[] = []
  const chunks: TickerItem[][] = []

  await Promise.all(
    jobs.map(async (job) => {
      if (!job.enabled) {
        feeds.push({
          id: job.id,
          label: job.label,
          builtin: job.builtin,
          enabled: false,
          status: 'off',
          error: null,
          updatedAt: null,
          itemCount: 0,
        })
        return
      }
      try {
        const xml = await fetchText(job.url)
        const items = parseFeedXml(xml, job.label, job.id)
        chunks.push(items)
        feeds.push({
          id: job.id,
          label: job.label,
          builtin: job.builtin,
          enabled: true,
          status: classifyFeedStatus({
            enabled: true,
            error: null,
            updatedAt: now,
            itemCount: items.length,
          }),
          error: null,
          updatedAt: now,
          itemCount: items.length,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'fetch failed'
        errors.push(`${job.label}: ${message}`)
        feeds.push({
          id: job.id,
          label: job.label,
          builtin: job.builtin,
          enabled: true,
          status: 'err',
          error: message,
          updatedAt: null,
          itemCount: 0,
        })
      }
    }),
  )

  const order = new Map(jobs.map((j, i) => [j.id, i]))
  feeds.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  return { items: chunks.flat(), feeds, errors }
}
