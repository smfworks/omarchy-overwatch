import { cellToBoundary, cellToLatLng, latLngToCell } from 'h3-js'
import type { LayerState } from '../globe/types'
import {
  HEAT_EVENTS_CAP,
  HEAT_MIN_LAYERS,
  HEAT_RES,
  type HeatCell,
  type HeatEventRef,
  type HeatHotspotInput,
  type HeatPointInput,
} from './types'

function validCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

/** Layers that currently contribute points to the poll window. */
export function layerContributes(layer: Pick<LayerState, 'enabled' | 'status' | 'points'>): boolean {
  if (!layer.enabled) return false
  if (layer.status === 'off' || layer.status === 'err') return false
  return true
}

export function pointsFromLayers(layers: LayerState[]): HeatPointInput[] {
  const out: HeatPointInput[] = []
  for (const layer of layers) {
    if (!layerContributes(layer)) continue
    if (layer.status !== 'live' && layer.status !== 'stale' && layer.status !== 'loading') continue
    for (const p of layer.points) {
      if (!validCoord(p.lat, p.lng)) continue
      const row: HeatPointInput = {
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        label: p.label,
        kind: p.kind,
        layerId: layer.id,
        layerLabel: layer.label,
      }
      if (p.extra) row.extra = p.extra
      if (p.observedAt) row.observedAt = p.observedAt
      out.push(row)
    }
  }
  return out
}

function cellIndex(lat: number, lng: number, res: number): string | null {
  try {
    return latLngToCell(lat, lng, res)
  } catch {
    return null
  }
}

function ringFor(h3: string): [number, number][] | null {
  try {
    const ring = cellToBoundary(h3, true) as [number, number][]
    if (!ring.length) return null
    return ring
  } catch {
    return null
  }
}

function centerFor(h3: string): { lat: number; lng: number } | null {
  try {
    const [lat, lng] = cellToLatLng(h3)
    if (!validCoord(lat, lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}

function populationZ(values: number[]): number[] {
  const n = values.length
  if (n < 2) return values.map(() => 0)
  const mean = values.reduce((s, v) => s + v, 0) / n
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const sigma = Math.sqrt(variance)
  if (!(sigma > 0)) return values.map(() => 0)
  return values.map((v) => (v - mean) / sigma)
}

export function computeHeat(
  points: HeatPointInput[],
  options?: {
    res?: number
    minLayers?: number
    hotspots?: HeatHotspotInput[]
    eventsCap?: number
  },
): HeatCell[] {
  const res = options?.res ?? HEAT_RES
  const minLayers = options?.minLayers ?? HEAT_MIN_LAYERS
  const eventsCap = options?.eventsCap ?? HEAT_EVENTS_CAP
  const buckets = new Map<
    string,
    { byLayer: Map<string, HeatEventRef[]>; layerLabel: Map<string, string> }
  >()

  for (const p of points) {
    if (!validCoord(p.lat, p.lng) || !p.layerId) continue
    const id = cellIndex(p.lat, p.lng, res)
    if (!id) continue
    let bucket = buckets.get(id)
    if (!bucket) {
      bucket = { byLayer: new Map(), layerLabel: new Map() }
      buckets.set(id, bucket)
    }
    bucket.layerLabel.set(p.layerId, p.layerLabel)
    const list = bucket.byLayer.get(p.layerId) ?? []
    const ev: HeatEventRef = {
      id: p.id,
      layerId: p.layerId,
      layerLabel: p.layerLabel,
      label: p.label,
      lat: p.lat,
      lng: p.lng,
      kind: p.kind,
    }
    if (p.extra) ev.extra = p.extra
    if (p.observedAt) ev.observedAt = p.observedAt
    list.push(ev)
    bucket.byLayer.set(p.layerId, list)
  }

  const hotspotHits = new Map<string, { id: string; name: string }[]>()
  for (const hs of options?.hotspots ?? []) {
    if (!validCoord(hs.lat, hs.lng)) continue
    const id = cellIndex(hs.lat, hs.lng, res)
    if (!id) continue
    const list = hotspotHits.get(id) ?? []
    list.push({ id: hs.id, name: hs.name })
    hotspotHits.set(id, list)
  }

  const draft: HeatCell[] = []
  for (const [id, bucket] of buckets) {
    const layerCount = bucket.byLayer.size
    if (layerCount < minLayers) continue
    const center = centerFor(id)
    const ring = ringFor(id)
    if (!center || !ring) continue
    const contributors = [...bucket.byLayer.entries()]
      .map(([layerId, events]) => ({
        layerId,
        layerLabel: bucket.layerLabel.get(layerId) ?? layerId,
        count: events.length,
      }))
      .sort((a, b) => b.count - a.count || a.layerId.localeCompare(b.layerId))
    const events = [...bucket.byLayer.values()]
      .flat()
      .sort((a, b) => a.layerId.localeCompare(b.layerId) || a.id.localeCompare(b.id))
      .slice(0, eventsCap)
    const pointCount = [...bucket.byLayer.values()].reduce((s, ev) => s + ev.length, 0)
    draft.push({
      id,
      res,
      lat: center.lat,
      lng: center.lng,
      ring,
      layerCount,
      pointCount,
      score: layerCount,
      z: 0,
      contributors,
      events,
      hotspots: hotspotHits.get(id) ?? [],
    })
  }

  const zs = populationZ(draft.map((c) => c.layerCount))
  for (let i = 0; i < draft.length; i++) draft[i].z = zs[i]
  draft.sort((a, b) => b.layerCount - a.layerCount || b.pointCount - a.pointCount || a.id.localeCompare(b.id))
  return draft
}
