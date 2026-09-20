export interface TickerItem {
  id: string
  source: string
  title: string
  url: string
  published: string | null
}

export type FeedStatus = 'loading' | 'live' | 'err' | 'empty'

function parseRss(xml: string, source: string): TickerItem[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('RSS parse error')
  const items = [...doc.querySelectorAll('item')].slice(0, 12)
  return items.map((item, i) => {
    const title = item.querySelector('title')?.textContent?.trim() || 'Untitled'
    const link = item.querySelector('link')?.textContent?.trim() || ''
    const pub = item.querySelector('pubDate')?.textContent?.trim() || null
    return {
      id: `${source}-${i}-${title.slice(0, 24)}`,
      source,
      title,
      url: link,
      published: pub,
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

export const FEED_SOURCES = [
  { id: 'bbc', label: 'BBC World', url: '/proxy/bbc/news/world/rss.xml' },
  { id: 'reliefweb', label: 'ReliefWeb', url: '/proxy/reliefweb/updates/rss.xml' },
  { id: 'gdacs', label: 'GDACS', url: '/proxy/gdacs/xml/rss.xml' },
] as const

export async function fetchTicker(): Promise<{ items: TickerItem[]; errors: string[] }> {
  const errors: string[] = []
  const chunks = await Promise.all(
    FEED_SOURCES.map(async (src) => {
      try {
        const xml = await fetchText(src.url)
        return parseRss(xml, src.label)
      } catch (err) {
        errors.push(`${src.label}: ${err instanceof Error ? err.message : 'fetch failed'}`)
        return [] as TickerItem[]
      }
    }),
  )
  const items = chunks.flat()
  return { items, errors }
}
