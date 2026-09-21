import type { Aoi, MapBounds } from '../aoi/geo'
import { pointInAoi, pointInBounds } from '../aoi/geo'
import type { GeoPoint } from '../globe/types'

export interface RegionItem {
  id: string
  label: string
  layerId: string
  layerLabel: string
  kind: string
  lat: number
  lng: number
  km: number
  observedAt?: string
}

export interface RegionSummary {
  /** Honest empty flag — UI must show UNKNOWN, not a sitrep. */
  unknown: boolean
  pointCount: number
  layerCounts: { layerId: string; layerLabel: string; count: number }[]
  nearest: RegionItem[]
  origin: { lat: number; lng: number }
  scope: 'aoi' | 'view'
}

const EARTH_KM = 6371

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = Math.PI / 180
  const dLat = (bLat - aLat) * r
  const dLng = (bLng - aLng) * r
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function summarizeRegion(opts: {
  points: GeoPoint[]
  origin: { lat: number; lng: number }
  aoi?: Aoi | null
  bounds?: MapBounds | null
  layerLabels?: Record<string, string>
  cap?: number
}): RegionSummary {
  const cap = opts.cap ?? 8
  const scoped = opts.points.filter((p) => {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false
    if (opts.aoi) return pointInAoi(p.lat, p.lng, opts.aoi)
    return pointInBounds(p.lat, p.lng, opts.bounds)
  })
  const counts = new Map<string, { layerId: string; layerLabel: string; count: number }>()
  const nearest: RegionItem[] = scoped
    .map((p) => {
      const layerId = p.layerId ?? p.kind
      const layerLabel = opts.layerLabels?.[layerId] ?? layerId
      const km = haversineKm(opts.origin.lat, opts.origin.lng, p.lat, p.lng)
      const item: RegionItem = {
        id: p.id,
        label: p.label,
        layerId,
        layerLabel,
        kind: p.kind,
        lat: p.lat,
        lng: p.lng,
        km,
      }
      if (p.observedAt) item.observedAt = p.observedAt
      const row = counts.get(layerId) ?? { layerId, layerLabel, count: 0 }
      row.count += 1
      counts.set(layerId, row)
      return item
    })
    .sort((a, b) => a.km - b.km)
    .slice(0, cap)

  return {
    unknown: scoped.length === 0,
    pointCount: scoped.length,
    layerCounts: [...counts.values()].sort((a, b) => b.count - a.count),
    nearest,
    origin: opts.origin,
    scope: opts.aoi ? 'aoi' : 'view',
  }
}
