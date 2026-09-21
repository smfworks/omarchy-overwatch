import { HEAT_FORMULA_LINE } from '../heat/formula'
import type { HeatCell } from '../heat/types'
import type { LayerState } from '../globe/types'
import type { TickerItem } from '../feeds/rss'
import type { Selection, StageMode } from '../state/context'
import { BRIEF_CELLS_CAP, BRIEF_HEADLINES_CAP, BRIEF_POINTS_CAP, type BriefSnapshot } from './types'

export const BRIEF_SYSTEM_PROMPT = `You are a local on-screen brief for Overwatch OSINT for Omarchy, a public-source HUD (not a scanner).

Rules:
- Cite only items present in the user JSON (layer points, headlines, heat cells, selection).
- If something is missing, say UNKNOWN. Do not guess.
- Never invent coordinates, events, headlines, casualties, attributions, or “classified” language.
- Never claim operational accuracy or completeness. Feeds may be LIVE, STALE, ERR, or empty.
- Heat scores are a transparent local formula (distinct layer count L, optional z vs local mean), not intelligence.
- Demo hotspots are static geography for navigation, not live sitreps.
- Output short markdown: Situation (from provided items) · Sources cited by id/label · Gaps (UNKNOWN).
- If the JSON is empty or failed, say so and stop.`

export function buildBriefSnapshot(input: {
  stage: StageMode
  layers: LayerState[]
  heatEnabled: boolean
  heatStatus: string
  heatCells: HeatCell[]
  selection: Selection
  ticker: TickerItem[]
  now?: Date
}): BriefSnapshot {
  const now = input.now ?? new Date()
  const points = input.layers.flatMap((layer) =>
    layer.enabled && (layer.status === 'live' || layer.status === 'stale' || layer.status === 'loading')
      ? layer.points.slice(0, 20).map((p) => ({
          id: p.id,
          layerId: layer.id,
          label: p.label,
          lat: p.lat,
          lng: p.lng,
          kind: p.kind,
          extra: p.extra,
          observedAt: p.observedAt,
        }))
      : [],
  )

  const selectedHeat =
    input.selection?.kind === 'heat'
      ? {
          id: input.selection.cell.id,
          lat: input.selection.cell.lat,
          lng: input.selection.cell.lng,
          layerCount: input.selection.cell.layerCount,
          pointCount: input.selection.cell.pointCount,
          z: input.selection.cell.z,
          contributors: input.selection.cell.contributors,
          events: input.selection.cell.events.map((e) => ({
            id: e.id,
            layerId: e.layerId,
            label: e.label,
            lat: e.lat,
            lng: e.lng,
            kind: e.kind,
          })),
        }
      : null

  let selection: Record<string, unknown> | null = null
  if (input.selection?.kind === 'tool') {
    selection = { kind: 'tool', id: input.selection.tool.id, name: input.selection.tool.name, url: input.selection.tool.url }
  } else if (input.selection?.kind === 'hotspot') {
    const hs = input.selection.hotspot
    selection = { kind: 'hotspot', id: hs.id, name: hs.name, lat: hs.lat, lng: hs.lng, note: 'static demo geography' }
  } else if (input.selection?.kind === 'point') {
    const p = input.selection.point
    selection = {
      kind: 'point',
      id: p.id,
      label: p.label,
      lat: p.lat,
      lng: p.lng,
      layerId: p.layerId ?? null,
      kindLive: p.kind,
    }
  } else if (input.selection?.kind === 'ticker') {
    const t = input.selection.item
    selection = { kind: 'ticker', id: t.id, title: t.title, source: t.source, url: t.url, published: t.published }
  } else if (input.selection?.kind === 'heat') {
    selection = { kind: 'heat', cellId: input.selection.cell.id, layerCount: input.selection.cell.layerCount }
  }

  return {
    generatedAt: now.toISOString(),
    disclaimer:
      'Structured dump of what is currently on screen from public feeds. Not a sitrep. Model must cite only these items.',
    stage: input.stage,
    layers: input.layers.map((l) => ({
      id: l.id,
      label: l.label,
      enabled: l.enabled,
      status: l.status,
      pointCount: l.points.length,
      error: l.error,
      updatedAt: l.updatedAt,
    })),
    heat: {
      enabled: input.heatEnabled,
      status: input.heatStatus,
      formula: HEAT_FORMULA_LINE,
      cellCount: input.heatCells.length,
      selected: selectedHeat,
      cells: input.heatCells.slice(0, BRIEF_CELLS_CAP).map((c) => ({
        id: c.id,
        lat: c.lat,
        lng: c.lng,
        layerCount: c.layerCount,
        pointCount: c.pointCount,
        z: Number(c.z.toFixed(3)),
      })),
    },
    selection,
    points: points.slice(0, BRIEF_POINTS_CAP),
    headlines: input.ticker.slice(0, BRIEF_HEADLINES_CAP).map((h) => ({
      id: h.id,
      source: h.source,
      title: h.title,
      url: h.url,
      published: h.published,
    })),
  }
}
