import type { OsintTool } from '../catalog/types'
import type { CasePin } from '../cases/types'
import type { TickerItem } from '../feeds/rss'
import type { GeoPoint } from '../globe/types'
import type { HeatCell } from '../heat/types'

export type SearchKind = 'tool' | 'point' | 'heat' | 'ticker' | 'pin'

export interface SearchHit {
  id: string
  kind: SearchKind
  title: string
  subtitle: string
  score: number
  tool?: OsintTool
  point?: GeoPoint
  cell?: HeatCell
  ticker?: TickerItem
  pin?: CasePin
}

function hay(parts: Array<string | undefined | null>): string {
  return parts.filter(Boolean).join(' ').toLowerCase()
}

function scoreText(query: string, text: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const t = text.toLowerCase()
  if (t === q) return 12
  if (t.startsWith(q)) return 9
  if (t.includes(q)) return 6
  const tokens = q.split(/\s+/).filter(Boolean)
  let n = 0
  for (const tok of tokens) {
    if (t.includes(tok)) n += 2
  }
  return n
}

export function searchWorkspace(query: string, corpus: {
  tools: OsintTool[]
  points: GeoPoint[]
  cells: HeatCell[]
  ticker: TickerItem[]
  pins: CasePin[]
  limit?: number
}): SearchHit[] {
  const q = query.trim()
  if (!q) return []
  const limit = corpus.limit ?? 24
  const hits: SearchHit[] = []

  for (const tool of corpus.tools) {
    const text = hay([tool.name, tool.description, tool.category, tool.subcategory, ...(tool.tags ?? []), ...(tool.inputs ?? [])])
    const score = scoreText(q, tool.name) * 2 + scoreText(q, text)
    if (score <= 0) continue
    hits.push({
      id: `tool:${tool.id}`,
      kind: 'tool',
      title: tool.name,
      subtitle: `${tool.category} · ${tool.opsec} · ${tool.pricing}`,
      score,
      tool,
    })
  }

  for (const point of corpus.points) {
    const text = hay([point.label, point.kind, point.layerId, point.headline, point.extra, point.eventType])
    const score = scoreText(q, point.label) * 2 + scoreText(q, text)
    if (score <= 0) continue
    hits.push({
      id: `point:${point.id}`,
      kind: 'point',
      title: point.label,
      subtitle: `${point.kind}${point.layerId ? ` · ${point.layerId}` : ''} · ${point.lat.toFixed(2)}°, ${point.lng.toFixed(2)}°`,
      score,
      point,
    })
  }

  for (const cell of corpus.cells) {
    const contrib = cell.contributors.map((c) => c.layerLabel).join(' ')
    const text = hay([cell.id, contrib, `L${cell.layerCount}`, ...cell.events.map((e) => e.label)])
    const score = scoreText(q, text) + (q.toLowerCase() === 'heat' ? 4 : 0)
    if (score <= 0) continue
    hits.push({
      id: `heat:${cell.id}`,
      kind: 'heat',
      title: `HEAT L=${cell.layerCount} · ${cell.id}`,
      subtitle: `${cell.lat.toFixed(2)}°, ${cell.lng.toFixed(2)}° · ${cell.contributors.map((c) => c.layerLabel).join(' + ')}`,
      score,
      cell,
    })
  }

  for (const item of corpus.ticker) {
    const text = hay([item.title, item.source, item.published ?? ''])
    const score = scoreText(q, item.title) * 2 + scoreText(q, text)
    if (score <= 0) continue
    hits.push({
      id: `ticker:${item.id}`,
      kind: 'ticker',
      title: item.title,
      subtitle: `${item.source}${item.published ? ` · ${item.published}` : ''}`,
      score,
      ticker: item,
    })
  }

  for (const pin of corpus.pins) {
    const extra = 'url' in pin ? pin.url : 'lat' in pin ? `${pin.lat} ${pin.lng}` : ''
    const text = hay([pin.label, pin.type, extra])
    const score = scoreText(q, pin.label) * 2 + scoreText(q, text)
    if (score <= 0) continue
    hits.push({
      id: `pin:${pin.type}:${pin.id}`,
      kind: 'pin',
      title: pin.label,
      subtitle: `case pin · ${pin.type}`,
      score,
      pin,
    })
  }

  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit)
}
